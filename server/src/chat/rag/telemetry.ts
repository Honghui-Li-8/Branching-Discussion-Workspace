import {
  InMemoryJobMetrics,
  type JobMetricsRecorder,
} from '../../jobs/metrics.js'
import { createLogger } from '../../logging/logger.js'

export interface RagLogger {
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, context?: Record<string, unknown>) => void
}

export const ragMetrics = new InMemoryJobMetrics()

type RecordRetrievalTelemetryInput = {
  turnId: string
  nodeId: string
  authorUserId: string
  retriever: string
  ragEnabled: boolean
  startedAtMs: number
  chunksReturned: number
  chunksSelected: number
  citationCount: number
  snapshotId?: string | null
  fallbackReason?: string | null
}

type RecordIndexingTelemetryInput = {
  jobId: string
  turnId: string
  retriever: string
  startedAtMs: number
  result: 'success' | 'failed' | 'skipped'
  chunkCount: number
  nodeId?: string | null
  authorUserId?: string | null
  reason?: string | null
}

type TelemetryDeps = {
  metrics: JobMetricsRecorder
  logger: RagLogger
  now: () => number
}

const DEFAULT_DEPS: TelemetryDeps = {
  metrics: ragMetrics,
  logger: createLogger('rag-telemetry'),
  now: () => Date.now(),
}

const getDurationSeconds = (startedAtMs: number, now: () => number): number =>
  Math.max(0, now() - startedAtMs) / 1000

export const recordRetrievalTelemetry = (
  input: RecordRetrievalTelemetryInput,
  deps: Partial<TelemetryDeps> = {},
): void => {
  const resolvedDeps = {
    ...DEFAULT_DEPS,
    ...deps,
  }
  const durationSeconds = getDurationSeconds(input.startedAtMs, resolvedDeps.now)
  const labels = {
    retriever: input.retriever,
    rag_enabled: input.ragEnabled,
  }
  const result = input.fallbackReason ? 'fallback' : 'success'

  resolvedDeps.metrics.incrementCounter('rag.retrieval_attempts_total', 1, labels)
  if (input.chunksReturned > 0) {
    resolvedDeps.metrics.incrementCounter('rag.retrieval_hits_total', 1, {
      retriever: input.retriever,
    })
  }
  if (input.fallbackReason) {
    resolvedDeps.metrics.incrementCounter('rag.retrieval_fallbacks_total', 1, {
      retriever: input.retriever,
      reason: input.fallbackReason,
    })
  }
  resolvedDeps.metrics.observeHistogram('rag.retrieval_latency_seconds', durationSeconds, {
    retriever: input.retriever,
    result,
  })
  resolvedDeps.metrics.observeHistogram('rag.retrieval_chunks_returned', input.chunksReturned, {
    retriever: input.retriever,
    result,
  })
  resolvedDeps.metrics.observeHistogram('rag.retrieval_chunks_selected', input.chunksSelected, {
    retriever: input.retriever,
    result,
  })
  resolvedDeps.metrics.observeHistogram('rag.retrieval_citation_count', input.citationCount, {
    retriever: input.retriever,
    result,
  })

  const logMessage = input.fallbackReason
    ? '[rag] retrieval fell back to base prompt.'
    : '[rag] retrieval completed.'
  const logContext = {
    turn_id: input.turnId,
    node_id: input.nodeId,
    author_user_id: input.authorUserId,
    retriever: input.retriever,
    rag_enabled: input.ragEnabled,
    snapshot_id: input.snapshotId ?? null,
    latency_seconds: durationSeconds,
    chunks_returned: input.chunksReturned,
    chunks_selected: input.chunksSelected,
    citation_count: input.citationCount,
    ...(input.fallbackReason ? { fallback_reason: input.fallbackReason } : {}),
  }

  if (input.fallbackReason) {
    resolvedDeps.logger.warn(logMessage, logContext)
    return
  }
  resolvedDeps.logger.info(logMessage, logContext)
}

export const recordIndexingTelemetry = (
  input: RecordIndexingTelemetryInput,
  deps: Partial<TelemetryDeps> = {},
): void => {
  const resolvedDeps = {
    ...DEFAULT_DEPS,
    ...deps,
  }
  const durationSeconds = getDurationSeconds(input.startedAtMs, resolvedDeps.now)

  resolvedDeps.metrics.incrementCounter('rag.indexing_attempts_total', 1, {
    retriever: input.retriever,
  })
  resolvedDeps.metrics.incrementCounter('rag.indexing_completed_total', 1, {
    retriever: input.retriever,
    result: input.result,
  })
  resolvedDeps.metrics.observeHistogram('rag.indexing_latency_seconds', durationSeconds, {
    retriever: input.retriever,
    result: input.result,
  })
  resolvedDeps.metrics.observeHistogram('rag.indexing_chunks_total', input.chunkCount, {
    retriever: input.retriever,
    result: input.result,
  })

  const logContext = {
    job_id: input.jobId,
    turn_id: input.turnId,
    node_id: input.nodeId ?? null,
    author_user_id: input.authorUserId ?? null,
    retriever: input.retriever,
    result: input.result,
    chunk_count: input.chunkCount,
    latency_seconds: durationSeconds,
    ...(input.reason ? { reason: input.reason } : {}),
  }

  if (input.result === 'failed') {
    resolvedDeps.logger.error('[rag] indexing failed.', logContext)
    return
  }

  if (input.result === 'skipped') {
    resolvedDeps.logger.warn('[rag] indexing skipped.', logContext)
    return
  }

  resolvedDeps.logger.info('[rag] indexing completed.', logContext)
}
