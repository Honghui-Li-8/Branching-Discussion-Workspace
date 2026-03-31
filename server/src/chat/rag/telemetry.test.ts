import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { InMemoryJobMetrics } from '../../jobs/metrics'
import {
  recordIndexingTelemetry,
  recordRetrievalTelemetry,
} from './telemetry'

const createDeps = () => {
  const metrics = new InMemoryJobMetrics()
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  return {
    metrics,
    logger,
    now: jest.fn(() => 2_000),
  }
}

describe('rag telemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('records retrieval success metrics and logs', () => {
    const deps = createDeps()

    recordRetrievalTelemetry(
      {
        turnId: 't1',
        nodeId: 'n1',
        authorUserId: 'u1',
        retriever: 'vector_v1',
        ragEnabled: true,
        startedAtMs: 1_000,
        chunksReturned: 3,
        chunksSelected: 2,
        citationCount: 2,
        snapshotId: 'snapshot-1',
      },
      deps,
    )

    const snapshot = deps.metrics.snapshot()
    expect(snapshot.counters['rag.retrieval_attempts_total{rag_enabled=true,retriever=vector_v1}']).toBe(1)
    expect(snapshot.counters['rag.retrieval_hits_total{retriever=vector_v1}']).toBe(1)
    expect(snapshot.histograms['rag.retrieval_latency_seconds{result=success,retriever=vector_v1}']).toEqual({
      count: 1,
      sum: 1,
      min: 1,
      max: 1,
    })
    expect(deps.logger.info).toHaveBeenCalledWith(
      '[rag] retrieval completed.',
      expect.objectContaining({
        turn_id: 't1',
        node_id: 'n1',
        author_user_id: 'u1',
        retriever: 'vector_v1',
        rag_enabled: true,
        snapshot_id: 'snapshot-1',
        chunks_returned: 3,
        chunks_selected: 2,
        citation_count: 2,
      }),
    )
  })

  test('records retrieval fallback metrics and warning logs', () => {
    const deps = createDeps()

    recordRetrievalTelemetry(
      {
        turnId: 't1',
        nodeId: 'n1',
        authorUserId: 'u1',
        retriever: 'vector_v1',
        ragEnabled: true,
        startedAtMs: 1_000,
        chunksReturned: 0,
        chunksSelected: 0,
        citationCount: 0,
        fallbackReason: 'retrieval_failed',
      },
      deps,
    )

    const snapshot = deps.metrics.snapshot()
    expect(snapshot.counters['rag.retrieval_fallbacks_total{reason=retrieval_failed,retriever=vector_v1}']).toBe(1)
    expect(deps.logger.warn).toHaveBeenCalledWith(
      '[rag] retrieval fell back to base prompt.',
      expect.objectContaining({
        fallback_reason: 'retrieval_failed',
      }),
    )
  })

  test('records indexing results with structured logs', () => {
    const deps = createDeps()

    recordIndexingTelemetry(
      {
        jobId: 'job-1',
        turnId: 't1',
        nodeId: 'n1',
        authorUserId: 'u1',
        retriever: 'vector_v1',
        startedAtMs: 1_000,
        result: 'success',
        chunkCount: 4,
      },
      deps,
    )

    const snapshot = deps.metrics.snapshot()
    expect(snapshot.counters['rag.indexing_attempts_total{retriever=vector_v1}']).toBe(1)
    expect(snapshot.counters['rag.indexing_completed_total{result=success,retriever=vector_v1}']).toBe(1)
    expect(deps.logger.info).toHaveBeenCalledWith(
      '[rag] indexing completed.',
      expect.objectContaining({
        job_id: 'job-1',
        turn_id: 't1',
        node_id: 'n1',
        author_user_id: 'u1',
        chunk_count: 4,
      }),
    )
  })
})
