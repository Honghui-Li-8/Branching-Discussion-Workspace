import { randomUUID } from 'node:crypto'
import type { ConversationPostprocessJobRecord } from '../db/models/conversationPostprocessJob.js'
import {
  getConversationPostprocessJobQueueSnapshot,
  leaseDueConversationPostprocessJobs,
  markConversationPostprocessJobFailed,
  markConversationPostprocessJobSucceeded,
  requeueConversationPostprocessJobWithBackoff,
} from '../db/queries/conversationPostprocessJob.js'
import {
  appendConversationTurnEvent,
  getMaxConversationTurnEventSeq,
} from '../db/queries/conversationTurnEvent.js'
import { indexTurn, summarizeTurn } from './handlers.js'
import { type JobMetricsRecorder, jobMetrics } from './metrics.js'

export type WorkerLogger = Pick<Console, 'info' | 'warn' | 'error'>

type ConversationPostprocessWorkerDeps = {
  leaseDueConversationPostprocessJobs: typeof leaseDueConversationPostprocessJobs
  markConversationPostprocessJobSucceeded: typeof markConversationPostprocessJobSucceeded
  markConversationPostprocessJobFailed: typeof markConversationPostprocessJobFailed
  requeueConversationPostprocessJobWithBackoff: typeof requeueConversationPostprocessJobWithBackoff
  getConversationPostprocessJobQueueSnapshot: typeof getConversationPostprocessJobQueueSnapshot
  appendConversationTurnEvent: typeof appendConversationTurnEvent
  getMaxConversationTurnEventSeq: typeof getMaxConversationTurnEventSeq
  summarizeTurn: (job: ConversationPostprocessJobRecord) => Promise<void>
  indexTurn: (job: ConversationPostprocessJobRecord) => Promise<void>
  metrics: JobMetricsRecorder
  logger: WorkerLogger
}

export type ConversationPostprocessWorkerOptions = {
  leaseOwner: string
  pollIntervalMs: number
  batchSize: number
  leaseTimeoutMs: number
  retryBaseDelaySeconds: number
  retryMaxDelaySeconds: number
}

const DEFAULT_OPTIONS: ConversationPostprocessWorkerOptions = {
  leaseOwner: `worker-${randomUUID()}`,
  pollIntervalMs: 2_000,
  batchSize: 10,
  leaseTimeoutMs: 60_000,
  retryBaseDelaySeconds: 5,
  retryMaxDelaySeconds: 300,
}
const MAX_EVENT_APPEND_ATTEMPTS = 4

const DEFAULT_DEPS: ConversationPostprocessWorkerDeps = {
  leaseDueConversationPostprocessJobs,
  markConversationPostprocessJobSucceeded,
  markConversationPostprocessJobFailed,
  requeueConversationPostprocessJobWithBackoff,
  getConversationPostprocessJobQueueSnapshot,
  appendConversationTurnEvent,
  getMaxConversationTurnEventSeq,
  summarizeTurn,
  indexTurn,
  metrics: jobMetrics,
  logger: console,
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown job processing error.'

const isUniqueViolationError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505'

type SummaryLifecycleEventPayload =
  | {
      type: 'summary.completed'
      attemptCount: number
      metadata?: Record<string, unknown>
    }
  | {
      type: 'summary.failed'
      attemptCount: number
      terminal: boolean
      error: string
    }

const appendNextTurnEventWithRetry = async (
  deps: ConversationPostprocessWorkerDeps,
  turnId: string,
  eventType: SummaryLifecycleEventPayload['type'],
  payload: Record<string, unknown>,
): Promise<boolean> => {
  let attempt = 0
  while (attempt < MAX_EVENT_APPEND_ATTEMPTS) {
    attempt += 1
    try {
      const maxSeq = await deps.getMaxConversationTurnEventSeq(turnId)
      const persistedEvent = await deps.appendConversationTurnEvent({
        turnId,
        seq: maxSeq + 1,
        eventType,
        payload,
      })
      return persistedEvent !== null
    } catch (error) {
      if (isUniqueViolationError(error) && attempt < MAX_EVENT_APPEND_ATTEMPTS) {
        continue
      }
      throw error
    }
  }

  return false
}

const emitSummaryLifecycleEvent = async (
  deps: ConversationPostprocessWorkerDeps,
  job: ConversationPostprocessJobRecord,
  event: SummaryLifecycleEventPayload,
): Promise<void> => {
  if (job.jobType !== 'summary') {
    return
  }

  const basePayload = {
    jobId: job.id,
    jobType: 'summary',
    attemptCount: event.attemptCount,
  } satisfies Record<string, unknown>

  const payload = event.type === 'summary.completed'
    ? {
        ...basePayload,
        ...(event.metadata ? { metadata: event.metadata } : {}),
      }
    : {
        ...basePayload,
        terminal: event.terminal,
        error: event.error,
      }

  try {
    const wasPersisted = await appendNextTurnEventWithRetry(
      deps,
      job.turnId,
      event.type,
      payload,
    )
    if (wasPersisted) {
      deps.metrics.incrementCounter('jobs.summary_event_emitted_total', 1, {
        event_type: event.type,
      })
      return
    }

    deps.metrics.incrementCounter('jobs.summary_event_skipped_total', 1, {
      event_type: event.type,
    })
    deps.logger.warn('[jobs] Summary lifecycle event skipped because turn was not found.', {
      turn_id: job.turnId,
      job_id: job.id,
      event_type: event.type,
    })
  } catch (error) {
    deps.metrics.incrementCounter('jobs.summary_event_errors_total', 1, {
      event_type: event.type,
    })
    deps.logger.warn('[jobs] Failed to persist summary lifecycle event.', {
      turn_id: job.turnId,
      job_id: job.id,
      event_type: event.type,
      error,
    })
  }
}

const recordQueueSnapshot = async (
  deps: ConversationPostprocessWorkerDeps,
): Promise<void> => {
  try {
    const snapshot = await deps.getConversationPostprocessJobQueueSnapshot()
    deps.metrics.setGauge('jobs.queue_depth', snapshot.queued, { status: 'queued' })
    deps.metrics.setGauge('jobs.queue_depth', snapshot.running, { status: 'running' })
    deps.metrics.setGauge('jobs.queue_depth', snapshot.succeeded, { status: 'succeeded' })
    deps.metrics.setGauge('jobs.queue_depth', snapshot.failed, { status: 'failed' })
    deps.metrics.setGauge(
      'jobs.queue_oldest_age_seconds',
      snapshot.oldestQueuedAgeSeconds ?? 0,
      { status: 'queued' },
    )
  } catch (error) {
    deps.logger.warn('[jobs] failed to refresh queue snapshot metrics.', { error })
  }
}

const getHandlerForJob = (
  job: ConversationPostprocessJobRecord,
  deps: ConversationPostprocessWorkerDeps,
): ((job: ConversationPostprocessJobRecord) => Promise<void>) => {
  if (job.jobType === 'summary') {
    return deps.summarizeTurn
  }

  if (job.jobType === 'index') {
    return deps.indexTurn
  }

  throw new Error(`Unsupported conversation postprocess job type "${job.jobType}".`)
}

export const processLeasedConversationPostprocessJob = async (
  job: ConversationPostprocessJobRecord,
  deps: ConversationPostprocessWorkerDeps,
  options: ConversationPostprocessWorkerOptions,
): Promise<void> => {
  const startedAtMs = Date.now()
  deps.metrics.incrementCounter('jobs.started_total', 1, { job_type: job.jobType })

  try {
    const handler = getHandlerForJob(job, deps)
    await handler(job)

    const markedSucceeded = await deps.markConversationPostprocessJobSucceeded({
      id: job.id,
      leaseOwner: options.leaseOwner,
    })
    if (!markedSucceeded) {
      deps.metrics.incrementCounter('jobs.transition_conflict_total', 1, {
        job_type: job.jobType,
        transition: 'running->succeeded',
      })
      deps.logger.warn('[jobs] Unable to mark job succeeded (lease mismatch or state mismatch).', {
        job_id: job.id,
        turn_id: job.turnId,
        job_type: job.jobType,
        lease_owner: options.leaseOwner,
        status_transition: 'running->succeeded',
      })
      return
    }

    deps.metrics.incrementCounter('jobs.completed_total', 1, { job_type: job.jobType })
    deps.metrics.observeHistogram(
      'jobs.processing_seconds',
      (Date.now() - startedAtMs) / 1_000,
      { job_type: job.jobType, result: 'succeeded' },
    )
    deps.logger.info('[jobs] transition applied.', {
      job_id: job.id,
      turn_id: job.turnId,
      job_type: job.jobType,
      lease_owner: options.leaseOwner,
      status_transition: 'running->succeeded',
      attempt_count: markedSucceeded.attemptCount,
    })
    await emitSummaryLifecycleEvent(deps, job, {
      type: 'summary.completed',
      attemptCount: markedSucceeded.attemptCount,
    })
  } catch (error) {
    const lastError = getErrorMessage(error)
    const nextAttemptCount = job.attemptCount + 1

    if (nextAttemptCount >= job.maxAttempts) {
      const markedFailed = await deps.markConversationPostprocessJobFailed({
        id: job.id,
        leaseOwner: options.leaseOwner,
        lastError,
      })
      if (!markedFailed) {
        deps.metrics.incrementCounter('jobs.transition_conflict_total', 1, {
          job_type: job.jobType,
          transition: 'running->failed',
        })
        deps.logger.warn('[jobs] Unable to mark job failed (lease mismatch or state mismatch).', {
          job_id: job.id,
          turn_id: job.turnId,
          job_type: job.jobType,
          lease_owner: options.leaseOwner,
          status_transition: 'running->failed',
          last_error: lastError,
        })
        return
      }

      deps.metrics.incrementCounter('jobs.failed_total', 1, { job_type: job.jobType })
      deps.metrics.observeHistogram(
        'jobs.processing_seconds',
        (Date.now() - startedAtMs) / 1_000,
        { job_type: job.jobType, result: 'failed_terminal' },
      )
      deps.logger.error('[jobs] transition applied.', {
        job_id: job.id,
        turn_id: job.turnId,
        job_type: job.jobType,
        lease_owner: options.leaseOwner,
        status_transition: 'running->failed',
        attempt_count: markedFailed.attemptCount,
        max_attempts: markedFailed.maxAttempts,
        last_error: lastError,
      })
      await emitSummaryLifecycleEvent(deps, job, {
        type: 'summary.failed',
        attemptCount: markedFailed.attemptCount,
        terminal: true,
        error: lastError,
      })
      return
    }

    const requeuedJob = await deps.requeueConversationPostprocessJobWithBackoff({
      id: job.id,
      leaseOwner: options.leaseOwner,
      lastError,
      baseDelaySeconds: options.retryBaseDelaySeconds,
      maxDelaySeconds: options.retryMaxDelaySeconds,
    })
    if (!requeuedJob) {
      deps.metrics.incrementCounter('jobs.transition_conflict_total', 1, {
        job_type: job.jobType,
        transition: 'running->queued',
      })
      deps.logger.warn('[jobs] Unable to requeue failed job (lease mismatch or state mismatch).', {
        job_id: job.id,
        turn_id: job.turnId,
        job_type: job.jobType,
        lease_owner: options.leaseOwner,
        status_transition: 'running->queued',
        last_error: lastError,
      })
      return
    }

    deps.metrics.incrementCounter('jobs.retried_total', 1, { job_type: job.jobType })
    deps.metrics.observeHistogram(
      'jobs.processing_seconds',
      (Date.now() - startedAtMs) / 1_000,
      { job_type: job.jobType, result: 'requeued' },
    )
    deps.logger.warn('[jobs] transition applied.', {
      job_id: job.id,
      turn_id: job.turnId,
      job_type: job.jobType,
      lease_owner: options.leaseOwner,
      status_transition: 'running->queued',
      attempt_count: requeuedJob.attemptCount,
      max_attempts: requeuedJob.maxAttempts,
      run_after: requeuedJob.runAfter,
      last_error: lastError,
    })
    await emitSummaryLifecycleEvent(deps, job, {
      type: 'summary.failed',
      attemptCount: requeuedJob.attemptCount,
      terminal: false,
      error: lastError,
    })
  }
}

export const runConversationPostprocessWorkerCycle = async (
  deps: ConversationPostprocessWorkerDeps = DEFAULT_DEPS,
  options: Partial<ConversationPostprocessWorkerOptions> = {},
): Promise<number> => {
  const resolvedOptions: ConversationPostprocessWorkerOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  }
  const leaseAt = new Date()
  const staleLeaseBefore = new Date(leaseAt.getTime() - resolvedOptions.leaseTimeoutMs)

  const leasedJobs = await deps.leaseDueConversationPostprocessJobs({
    leaseOwner: resolvedOptions.leaseOwner,
    leaseAt: leaseAt.toISOString(),
    staleLeaseBefore: staleLeaseBefore.toISOString(),
    limit: resolvedOptions.batchSize,
  })
  deps.metrics.incrementCounter('jobs.leased_total', leasedJobs.length)
  deps.metrics.setGauge('jobs.last_cycle_leased', leasedJobs.length)

  for (const job of leasedJobs) {
    await processLeasedConversationPostprocessJob(job, deps, resolvedOptions)
  }
  await recordQueueSnapshot(deps)

  return leasedJobs.length
}

export const startConversationPostprocessWorker = async (
  options: Partial<ConversationPostprocessWorkerOptions> = {},
  deps: ConversationPostprocessWorkerDeps = DEFAULT_DEPS,
): Promise<void> => {
  const resolvedOptions: ConversationPostprocessWorkerOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  }
  let isShuttingDown = false

  const onSignal = (signal: string) => {
    if (isShuttingDown) {
      return
    }
    isShuttingDown = true
    deps.logger.info('[jobs] shutdown signal received.', {
      signal,
      lease_owner: resolvedOptions.leaseOwner,
    })
  }

  process.on('SIGINT', () => onSignal('SIGINT'))
  process.on('SIGTERM', () => onSignal('SIGTERM'))

  deps.logger.info('[jobs] worker started.', {
    lease_owner: resolvedOptions.leaseOwner,
    poll_interval_ms: resolvedOptions.pollIntervalMs,
    batch_size: resolvedOptions.batchSize,
    lease_timeout_ms: resolvedOptions.leaseTimeoutMs,
  })

  while (!isShuttingDown) {
    try {
      const processedCount = await runConversationPostprocessWorkerCycle(
        deps,
        resolvedOptions,
      )
      deps.metrics.incrementCounter('jobs.cycles_total', 1)
      deps.metrics.setGauge('jobs.last_cycle_processed', processedCount)
      if (processedCount === 0) {
        deps.metrics.incrementCounter('jobs.idle_cycles_total', 1)
        await sleep(resolvedOptions.pollIntervalMs)
      }
    } catch (error) {
      deps.metrics.incrementCounter('jobs.cycle_errors_total', 1)
      deps.logger.error('[jobs] worker cycle failed.', {
        lease_owner: resolvedOptions.leaseOwner,
        error,
      })
      await sleep(resolvedOptions.pollIntervalMs)
    }
  }

  deps.logger.info('[jobs] worker stopped.', {
    lease_owner: resolvedOptions.leaseOwner,
  })
}
