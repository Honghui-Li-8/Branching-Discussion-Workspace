import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { ConversationPostprocessJobRecord } from '../db/models/conversationPostprocessJob.js'
import {
  processLeasedConversationPostprocessJob,
  runConversationPostprocessWorkerCycle,
} from './worker'

const baseJob: ConversationPostprocessJobRecord = {
  id: 'job-1',
  turnId: 'turn-1',
  jobType: 'summary',
  payload: {},
  status: 'running',
  attemptCount: 0,
  maxAttempts: 3,
  runAfter: '2026-03-31T00:00:00.000Z',
  lastError: null,
  leasedAt: '2026-03-31T00:00:10.000Z',
  leaseOwner: 'worker-1',
  finishedAt: null,
  createdAt: '2026-03-31T00:00:00.000Z',
  updatedAt: '2026-03-31T00:00:00.000Z',
}

const createTestDeps = () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  return {
    leaseDueConversationPostprocessJobs: jest.fn(
      async (_input: unknown) => [] as ConversationPostprocessJobRecord[],
    ),
    markConversationPostprocessJobSucceeded: jest.fn(async (_input: unknown) => ({
      ...baseJob,
      status: 'succeeded' as const,
      finishedAt: '2026-03-31T00:00:12.000Z',
    })),
    markConversationPostprocessJobFailed: jest.fn(async (_input: unknown) => ({
      ...baseJob,
      status: 'failed' as const,
      lastError: 'boom',
      finishedAt: '2026-03-31T00:00:12.000Z',
    })),
    requeueConversationPostprocessJobWithBackoff: jest.fn(async (_input: unknown) => ({
      ...baseJob,
      status: 'queued' as const,
      attemptCount: 1,
      runAfter: '2026-03-31T00:01:00.000Z',
      lastError: 'boom',
      leasedAt: null,
      leaseOwner: null,
    })),
    summarizeTurn: jest.fn(async (_job: ConversationPostprocessJobRecord) => {}),
    indexTurn: jest.fn(async (_job: ConversationPostprocessJobRecord) => {}),
    logger,
  }
}

describe('conversation postprocess worker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('runConversationPostprocessWorkerCycle leases due jobs and processes them once', async () => {
    const deps = createTestDeps()
    deps.leaseDueConversationPostprocessJobs.mockResolvedValueOnce([{ ...baseJob }])

    const processedCount = await runConversationPostprocessWorkerCycle(
      deps,
      {
        leaseOwner: 'worker-1',
        leaseTimeoutMs: 60_000,
        batchSize: 5,
      },
    )

    expect(processedCount).toBe(1)
    expect(deps.leaseDueConversationPostprocessJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseOwner: 'worker-1',
        limit: 5,
      }),
    )
    expect(deps.summarizeTurn).toHaveBeenCalledTimes(1)
    expect(deps.markConversationPostprocessJobSucceeded).toHaveBeenCalledWith({
      id: 'job-1',
      leaseOwner: 'worker-1',
    })
  })

  test('processLeasedConversationPostprocessJob requeues with backoff on retryable failure', async () => {
    const deps = createTestDeps()
    deps.summarizeTurn.mockRejectedValueOnce(new Error('summary failed'))

    await processLeasedConversationPostprocessJob(
      { ...baseJob, attemptCount: 0, maxAttempts: 3 },
      deps,
      {
        leaseOwner: 'worker-1',
        pollIntervalMs: 2_000,
        batchSize: 10,
        leaseTimeoutMs: 60_000,
        retryBaseDelaySeconds: 5,
        retryMaxDelaySeconds: 120,
      },
    )

    expect(deps.requeueConversationPostprocessJobWithBackoff).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-1',
        leaseOwner: 'worker-1',
        lastError: 'summary failed',
        baseDelaySeconds: 5,
        maxDelaySeconds: 120,
      }),
    )
    expect(deps.markConversationPostprocessJobFailed).not.toHaveBeenCalled()
  })

  test('processLeasedConversationPostprocessJob marks terminal failure at max attempts', async () => {
    const deps = createTestDeps()
    deps.summarizeTurn.mockRejectedValueOnce(new Error('still failing'))

    await processLeasedConversationPostprocessJob(
      { ...baseJob, attemptCount: 2, maxAttempts: 3 },
      deps,
      {
        leaseOwner: 'worker-1',
        pollIntervalMs: 2_000,
        batchSize: 10,
        leaseTimeoutMs: 60_000,
        retryBaseDelaySeconds: 5,
        retryMaxDelaySeconds: 120,
      },
    )

    expect(deps.markConversationPostprocessJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-1',
        leaseOwner: 'worker-1',
        lastError: 'still failing',
      }),
    )
    expect(deps.requeueConversationPostprocessJobWithBackoff).not.toHaveBeenCalled()
  })

  test('unknown job type follows failure path and remains retryable when attempts remain', async () => {
    const deps = createTestDeps()

    await processLeasedConversationPostprocessJob(
      { ...baseJob, jobType: 'custom_future_job', attemptCount: 0, maxAttempts: 2 },
      deps,
      {
        leaseOwner: 'worker-1',
        pollIntervalMs: 2_000,
        batchSize: 10,
        leaseTimeoutMs: 60_000,
        retryBaseDelaySeconds: 5,
        retryMaxDelaySeconds: 120,
      },
    )

    expect(deps.requeueConversationPostprocessJobWithBackoff).toHaveBeenCalled()
    expect(deps.markConversationPostprocessJobSucceeded).not.toHaveBeenCalled()
  })
})
