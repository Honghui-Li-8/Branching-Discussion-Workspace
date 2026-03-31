import { randomUUID } from 'node:crypto'
import type { ConversationPostprocessJobRecord } from '../db/models/conversationPostprocessJob.js'
import {
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

export type WorkerLogger = Pick<Console, 'info' | 'warn' | 'error'>

type ConversationPostprocessWorkerDeps = {
  leaseDueConversationPostprocessJobs: typeof leaseDueConversationPostprocessJobs
  markConversationPostprocessJobSucceeded: typeof markConversationPostprocessJobSucceeded
  markConversationPostprocessJobFailed: typeof markConversationPostprocessJobFailed
  requeueConversationPostprocessJobWithBackoff: typeof requeueConversationPostprocessJobWithBackoff
  appendConversationTurnEvent: typeof appendConversationTurnEvent
  getMaxConversationTurnEventSeq: typeof getMaxConversationTurnEventSeq
  summarizeTurn: (job: ConversationPostprocessJobRecord) => Promise<void>
  indexTurn: (job: ConversationPostprocessJobRecord) => Promise<void>
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
  appendConversationTurnEvent,
  getMaxConversationTurnEventSeq,
  summarizeTurn,
  indexTurn,
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
      return
    }

    deps.logger.warn('[jobs] Summary lifecycle event skipped because turn was not found.', {
      turnId: job.turnId,
      jobId: job.id,
      eventType: event.type,
    })
  } catch (error) {
    deps.logger.warn('[jobs] Failed to persist summary lifecycle event.', {
      turnId: job.turnId,
      jobId: job.id,
      eventType: event.type,
      error,
    })
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
  try {
    const handler = getHandlerForJob(job, deps)
    await handler(job)

    const markedSucceeded = await deps.markConversationPostprocessJobSucceeded({
      id: job.id,
      leaseOwner: options.leaseOwner,
    })
    if (!markedSucceeded) {
      deps.logger.warn('[jobs] Unable to mark job succeeded (lease mismatch or state mismatch).', {
        jobId: job.id,
        jobType: job.jobType,
        leaseOwner: options.leaseOwner,
      })
      return
    }

    deps.logger.info('[jobs] job completed.', {
      jobId: job.id,
      turnId: job.turnId,
      jobType: job.jobType,
      status: 'succeeded',
      attemptCount: markedSucceeded.attemptCount,
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
        deps.logger.warn('[jobs] Unable to mark job failed (lease mismatch or state mismatch).', {
          jobId: job.id,
          jobType: job.jobType,
          leaseOwner: options.leaseOwner,
          lastError,
        })
        return
      }

      deps.logger.error('[jobs] job reached max attempts and failed terminally.', {
        jobId: job.id,
        turnId: job.turnId,
        jobType: job.jobType,
        status: 'failed',
        attemptCount: markedFailed.attemptCount,
        maxAttempts: markedFailed.maxAttempts,
        lastError,
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
      deps.logger.warn('[jobs] Unable to requeue failed job (lease mismatch or state mismatch).', {
        jobId: job.id,
        jobType: job.jobType,
        leaseOwner: options.leaseOwner,
        lastError,
      })
      return
    }

    deps.logger.warn('[jobs] job failed and was requeued with backoff.', {
      jobId: job.id,
      turnId: job.turnId,
      jobType: job.jobType,
      status: 'queued',
      attemptCount: requeuedJob.attemptCount,
      maxAttempts: requeuedJob.maxAttempts,
      runAfter: requeuedJob.runAfter,
      lastError,
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

  for (const job of leasedJobs) {
    await processLeasedConversationPostprocessJob(job, deps, resolvedOptions)
  }

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
      leaseOwner: resolvedOptions.leaseOwner,
    })
  }

  process.on('SIGINT', () => onSignal('SIGINT'))
  process.on('SIGTERM', () => onSignal('SIGTERM'))

  deps.logger.info('[jobs] worker started.', {
    leaseOwner: resolvedOptions.leaseOwner,
    pollIntervalMs: resolvedOptions.pollIntervalMs,
    batchSize: resolvedOptions.batchSize,
    leaseTimeoutMs: resolvedOptions.leaseTimeoutMs,
  })

  while (!isShuttingDown) {
    try {
      const processedCount = await runConversationPostprocessWorkerCycle(
        deps,
        resolvedOptions,
      )
      if (processedCount === 0) {
        await sleep(resolvedOptions.pollIntervalMs)
      }
    } catch (error) {
      deps.logger.error('[jobs] worker cycle failed.', {
        leaseOwner: resolvedOptions.leaseOwner,
        error,
      })
      await sleep(resolvedOptions.pollIntervalMs)
    }
  }

  deps.logger.info('[jobs] worker stopped.', {
    leaseOwner: resolvedOptions.leaseOwner,
  })
}
