import type { ConversationPostprocessJobRecord } from '../db/models/conversationPostprocessJob.js'
import { getRagConfig } from '../chat/config.js'
import { chunkText } from '../chat/rag/chunker.js'
import { OpenAIEmbedder, type Embedder } from '../chat/rag/embedder.js'
import {
  recordIndexingTelemetry,
  type RagLogger,
} from '../chat/rag/telemetry.js'
import { getConversationTurnById } from '../db/queries/conversationTurn.js'
import { listMessagesByTurn } from '../db/queries/message.js'
import { upsertMessageRetrievalChunk } from '../db/queries/messageRetrievalChunk.js'
import type { ConversationTurnRecord, MessageRecord } from '../db/models/index.js'
import type { JobMetricsRecorder } from './metrics.js'
import { ragMetrics } from '../chat/rag/telemetry.js'
import { createLogger } from '../logging/logger.js'

export type JobHandler = (job: ConversationPostprocessJobRecord) => Promise<void>

export const summarizeTurn: JobHandler = async (_job) => {}

type IndexTurnDeps = {
  getConversationTurnById: (id: string) => Promise<ConversationTurnRecord | null>
  listMessagesByTurn: (turnId: string) => Promise<MessageRecord[]>
  upsertMessageRetrievalChunk: typeof upsertMessageRetrievalChunk
  createEmbedder: () => Embedder
  getRagConfig: typeof getRagConfig
  metrics: JobMetricsRecorder
  logger: RagLogger
  now: () => number
}

const DEFAULT_DEPS: IndexTurnDeps = {
  getConversationTurnById,
  listMessagesByTurn,
  upsertMessageRetrievalChunk,
  createEmbedder: () => new OpenAIEmbedder({ model: getRagConfig().embeddingModel }),
  getRagConfig,
  metrics: ragMetrics,
  logger: createLogger('jobs-handlers'),
  now: () => Date.now(),
}

type PendingChunk = {
  messageId: string
  nodeId: string
  authorUserId: string
  chunkIndex: number
  content: string
  tokenCount: number
}

const collectChunks = (messages: MessageRecord[]): PendingChunk[] =>
  messages.flatMap((message) =>
    chunkText(message.content).map((chunk) => ({
      messageId: message.id,
      nodeId: message.nodeId,
      authorUserId: message.authorUserId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
    })),
  )

export const createIndexTurnHandler = (
  deps: IndexTurnDeps = DEFAULT_DEPS,
): JobHandler =>
  async (job) => {
    const startedAtMs = deps.now()
    const ragConfig = deps.getRagConfig()
    if (!ragConfig.enabled || ragConfig.retriever !== 'vector_v1') {
      recordIndexingTelemetry(
        {
          jobId: job.id,
          turnId: job.turnId,
          retriever: ragConfig.retriever,
          startedAtMs,
          result: 'skipped',
          chunkCount: 0,
          reason: !ragConfig.enabled ? 'rag_disabled' : 'retriever_not_vector_v1',
        },
        deps,
      )
      return
    }

    const turn = await deps.getConversationTurnById(job.turnId)
    if (!turn) {
      recordIndexingTelemetry(
        {
          jobId: job.id,
          turnId: job.turnId,
          retriever: ragConfig.retriever,
          startedAtMs,
          result: 'skipped',
          chunkCount: 0,
          reason: 'turn_not_found',
        },
        deps,
      )
      return
    }
    try {
      const messages = await deps.listMessagesByTurn(turn.id)
      const chunks = collectChunks(
        messages.filter((message) => message.content.trim().length > 0),
      )
      if (chunks.length === 0) {
        recordIndexingTelemetry(
          {
            jobId: job.id,
            turnId: job.turnId,
            nodeId: turn.nodeId,
            authorUserId: turn.authorUserId,
            retriever: ragConfig.retriever,
            startedAtMs,
            result: 'success',
            chunkCount: 0,
          },
          deps,
        )
        return
      }

      const embedder = deps.createEmbedder()
      const embeddings = await embedder.embed(chunks.map((chunk) => chunk.content))
      if (embeddings.length !== chunks.length) {
        throw new Error('Embedding count mismatch for indexed chunks.')
      }

      await Promise.all(
        chunks.map((chunk, index) =>
          deps.upsertMessageRetrievalChunk({
            messageId: chunk.messageId,
            nodeId: chunk.nodeId,
            authorUserId: chunk.authorUserId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            embedding: embeddings[index] as number[],
          }),
        ),
      )

      recordIndexingTelemetry(
        {
          jobId: job.id,
          turnId: job.turnId,
          nodeId: turn.nodeId,
          authorUserId: turn.authorUserId,
          retriever: ragConfig.retriever,
          startedAtMs,
          result: 'success',
          chunkCount: chunks.length,
        },
        deps,
      )
    } catch (error) {
      recordIndexingTelemetry(
        {
          jobId: job.id,
          turnId: job.turnId,
          nodeId: turn.nodeId,
          authorUserId: turn.authorUserId,
          retriever: ragConfig.retriever,
          startedAtMs,
          result: 'failed',
          chunkCount: 0,
          reason: error instanceof Error ? error.message : 'indexing_failed',
        },
        deps,
      )
      throw error
    }
  }

export const indexTurn: JobHandler = createIndexTurnHandler()
