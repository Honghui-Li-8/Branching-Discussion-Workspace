import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  createOrGetConversationPostprocessJob,
  createOrGetConversationPostprocessJobForAuthor,
  findDueConversationPostprocessJobs,
  getConversationPostprocessJobQueueSnapshot,
  getConversationPostprocessJobById,
  leaseDueConversationPostprocessJobs,
  markConversationPostprocessJobFailed,
  markConversationPostprocessJobSucceeded,
  requeueConversationPostprocessJobWithBackoff,
} from './conversationPostprocessJob'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const postprocessJobRow = {
  id: 'job-1',
  turn_id: 'turn-1',
  job_type: 'summary',
  payload: { target: 'assistant-message' },
  status: 'queued' as const,
  attempt_count: 0,
  max_attempts: 5,
  run_after: '2026-03-31T00:00:00.000Z',
  last_error: null,
  leased_at: null,
  lease_owner: null,
  finished_at: null,
  created_at: '2026-03-31T00:00:00.000Z',
  updated_at: '2026-03-31T00:00:00.000Z',
}

describe('conversation postprocess job queries', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  test('getConversationPostprocessJobById maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [postprocessJobRow] } as never)

    const result = await getConversationPostprocessJobById('job-1')

    expect(result).toEqual({
      id: 'job-1',
      turnId: 'turn-1',
      jobType: 'summary',
      payload: { target: 'assistant-message' },
      status: 'queued',
      attemptCount: 0,
      maxAttempts: 5,
      runAfter: '2026-03-31T00:00:00.000Z',
      lastError: null,
      leasedAt: null,
      leaseOwner: null,
      finishedAt: null,
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:00:00.000Z',
    })
  })

  test('createOrGetConversationPostprocessJob returns inserted row with wasCreated=true', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...postprocessJobRow, was_created: true }],
    } as never)

    const result = await createOrGetConversationPostprocessJob({
      turnId: 'turn-1',
      jobType: 'summary',
      payload: { target: 'assistant-message' },
    })

    expect(result?.wasCreated).toBe(true)
    expect(result?.job.id).toBe('job-1')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (turn_id, job_type) DO NOTHING'),
      [
        'turn-1',
        'summary',
        JSON.stringify({ target: 'assistant-message' }),
        null,
        null,
        null,
        5,
        null,
        null,
        null,
        null,
        null,
      ],
    )
  })

  test('createOrGetConversationPostprocessJobForAuthor returns null for non-owner turn', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await createOrGetConversationPostprocessJobForAuthor(
      {
        turnId: 'turn-1',
        jobType: 'summary',
      },
      'user-2',
    )

    expect(result).toBeNull()
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND w.author_user_id = $2'),
      [
        'turn-1',
        'user-2',
        'summary',
        JSON.stringify({}),
        null,
        null,
        null,
        5,
        null,
        null,
        null,
        null,
        null,
      ],
    )
  })

  test('findDueConversationPostprocessJobs filters queued due jobs by run_after', async () => {
    queryMock.mockResolvedValueOnce({ rows: [postprocessJobRow] } as never)

    const result = await findDueConversationPostprocessJobs(
      '2026-03-31T00:30:00.000Z',
      25,
    )

    expect(result).toHaveLength(1)
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'queued'"),
      ['2026-03-31T00:30:00.000Z', 25],
    )
  })

  test('leaseDueConversationPostprocessJobs performs atomic SKIP LOCKED lease', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...postprocessJobRow, status: 'running', lease_owner: 'worker-1' }],
    } as never)

    const result = await leaseDueConversationPostprocessJobs({
      leaseOwner: 'worker-1',
      leaseAt: '2026-03-31T01:00:00.000Z',
      staleLeaseBefore: '2026-03-31T00:55:00.000Z',
      limit: 3,
    })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('running')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE SKIP LOCKED'),
      [
        '2026-03-31T01:00:00.000Z',
        '2026-03-31T00:55:00.000Z',
        3,
        'worker-1',
      ],
    )
  })

  test('markConversationPostprocessJobSucceeded updates running row to succeeded', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...postprocessJobRow, status: 'succeeded', finished_at: '2026-03-31T01:01:00.000Z' }],
    } as never)

    const result = await markConversationPostprocessJobSucceeded({
      id: 'job-1',
      leaseOwner: 'worker-1',
    })

    expect(result?.status).toBe('succeeded')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("status = 'succeeded'"),
      ['job-1', null, true, 'worker-1'],
    )
  })

  test('markConversationPostprocessJobFailed marks row failed with last_error', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...postprocessJobRow, status: 'failed', last_error: 'boom' }],
    } as never)

    const result = await markConversationPostprocessJobFailed({
      id: 'job-1',
      lastError: 'boom',
      leaseOwner: 'worker-1',
    })

    expect(result?.status).toBe('failed')
    expect(result?.lastError).toBe('boom')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed'"),
      ['job-1', 'boom', null, true, 'worker-1'],
    )
  })

  test('requeueConversationPostprocessJobWithBackoff increments attempts and queues retry', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...postprocessJobRow, status: 'queued', attempt_count: 1, last_error: 'boom' }],
    } as never)

    const result = await requeueConversationPostprocessJobWithBackoff({
      id: 'job-1',
      lastError: 'boom',
      leaseOwner: 'worker-1',
      baseDelaySeconds: 10,
      maxDelaySeconds: 60,
    })

    expect(result?.status).toBe('queued')
    expect(result?.attemptCount).toBe(1)
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('attempt_count = attempt_count + 1'),
      ['job-1', 'boom', null, 10, 60, true, 'worker-1'],
    )
  })

  test('getConversationPostprocessJobQueueSnapshot maps queue depth and age fields', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        queued_count: 3,
        running_count: 1,
        succeeded_count: 12,
        failed_count: 2,
        oldest_queued_age_seconds: 48.5,
      }],
    } as never)

    const result = await getConversationPostprocessJobQueueSnapshot(
      '2026-03-31T01:05:00.000Z',
    )

    expect(result).toEqual({
      queued: 3,
      running: 1,
      succeeded: 12,
      failed: 2,
      oldestQueuedAgeSeconds: 48.5,
    })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('COUNT(*) FILTER (WHERE status = \'queued\')'),
      ['2026-03-31T01:05:00.000Z'],
    )
  })
})
