import type { ConversationPostprocessJobRecord } from '../db/models/conversationPostprocessJob.js'
import { getRagConfig } from '../chat/config.js'
import { chunkText } from '../chat/rag/chunker.js'
import { OpenAIEmbedder, type Embedder } from '../chat/rag/embedder.js'
import { getConversationTurnById } from '../db/queries/conversationTurn.js'
import { listMessagesByTurn } from '../db/queries/message.js'
import { upsertMessageRetrievalChunk } from '../db/queries/messageRetrievalChunk.js'
import type { ConversationTurnRecord, MessageRecord } from '../db/models/index.js'

export type JobHandler = (job: ConversationPostprocessJobRecord) => Promise<void>

export const summarizeTurn: JobHandler = async (_job) => {}

type IndexTurnDeps = {
  getConversationTurnById: (id: string) => Promise<ConversationTurnRecord | null>
  listMessagesByTurn: (turnId: string) => Promise<MessageRecord[]>
  upsertMessageRetrievalChunk: typeof upsertMessageRetrievalChunk
  createEmbedder: () => Embedder
  getRagConfig: typeof getRagConfig
}

const DEFAULT_DEPS: IndexTurnDeps = {
  getConversationTurnById,
  listMessagesByTurn,
  upsertMessageRetrievalChunk,
  createEmbedder: () => new OpenAIEmbedder({ model: getRagConfig().embeddingModel }),
  getRagConfig,
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
    const ragConfig = deps.getRagConfig()
    if (!ragConfig.enabled || ragConfig.retriever !== 'vector_v1') {
      return
    }

    const turn = await deps.getConversationTurnById(job.turnId)
    if (!turn) {
      return
    }

    const messages = await deps.listMessagesByTurn(turn.id)
    const chunks = collectChunks(
      messages.filter((message) => message.content.trim().length > 0),
    )
    if (chunks.length === 0) {
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
  }

export const indexTurn: JobHandler = createIndexTurnHandler()
