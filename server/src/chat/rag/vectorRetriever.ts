import type { Citation, RetrievedChunk, RetrieverInput, RetrieverResult } from '@branching/shared'
import type { RagConfig } from '../config.js'
import { getRagConfig } from '../config.js'
import { OpenAIEmbedder, type Embedder } from './embedder.js'
import {
  searchMessageRetrievalChunks,
} from '../../db/queries/messageRetrievalChunk.js'
import type {
  ScoredMessageRetrievalChunkRecord,
  SearchMessageRetrievalChunksInput,
} from '../../db/models/messageRetrievalChunk.js'
import type { Retriever } from './retriever.js'

const MAX_VECTOR_RESULTS = 12
const DEFAULT_PER_MESSAGE_LIMIT = 2

type VectorRetrieverDeps = {
  createEmbedder: () => Embedder
  searchMessageRetrievalChunks: (
    input: SearchMessageRetrievalChunksInput,
  ) => Promise<ScoredMessageRetrievalChunkRecord[]>
  getRagConfig: typeof getRagConfig
}

const DEFAULT_DEPS: VectorRetrieverDeps = {
  createEmbedder: () => new OpenAIEmbedder({ model: getRagConfig().embeddingModel }),
  searchMessageRetrievalChunks,
  getRagConfig,
}

export const buildCitationsFromChunks = (
  chunks: RetrievedChunk[],
): Citation[] =>
  chunks.map((chunk) => ({
    messageId: chunk.messageId,
    nodeId: chunk.nodeId,
    chunkIndex: chunk.chunkIndex,
    excerpt: chunk.content,
    score: chunk.score,
  }))

const toRetrievedChunk = (
  row: ScoredMessageRetrievalChunkRecord,
): RetrievedChunk => ({
  messageId: row.messageId,
  nodeId: row.nodeId,
  chunkIndex: row.chunkIndex,
  content: row.content,
  tokenCount: row.tokenCount,
  score: row.score,
})

const applyPerMessageLimit = (
  rows: ScoredMessageRetrievalChunkRecord[],
  maxChunks: number,
  perMessageLimit: number,
  scoreThreshold: number,
): ScoredMessageRetrievalChunkRecord[] => {
  const countsByMessageId = new Map<string, number>()
  const selected: ScoredMessageRetrievalChunkRecord[] = []

  for (const row of rows) {
    if (row.score < scoreThreshold) {
      continue
    }

    const currentCount = countsByMessageId.get(row.messageId) ?? 0
    if (currentCount >= perMessageLimit) {
      continue
    }

    selected.push(row)
    countsByMessageId.set(row.messageId, currentCount + 1)
    if (selected.length >= maxChunks) {
      break
    }
  }

  return selected
}

export class VectorRetrieverV1 implements Retriever {
  readonly id = 'vector_v1'
  private readonly deps: VectorRetrieverDeps
  private readonly perMessageLimit: number

  constructor(
    deps: Partial<VectorRetrieverDeps> = {},
    options: { perMessageLimit?: number } = {},
  ) {
    this.deps = {
      ...DEFAULT_DEPS,
      ...deps,
    }
    this.perMessageLimit = options.perMessageLimit ?? DEFAULT_PER_MESSAGE_LIMIT
  }

  async retrieve(input: RetrieverInput): Promise<RetrieverResult> {
    const ragConfig: RagConfig = this.deps.getRagConfig()
    const maxChunks = Math.min(
      input.maxChunks ?? ragConfig.maxChunks,
      MAX_VECTOR_RESULTS,
    )

    const embedder = this.deps.createEmbedder()
    const [queryEmbedding] = await embedder.embed([input.query])
    if (!queryEmbedding) {
      throw new Error('Query embedding generation returned no vectors.')
    }

    const rankedRows = await this.deps.searchMessageRetrievalChunks({
      nodeId: input.nodeId,
      authorUserId: input.authorUserId,
      embedding: queryEmbedding,
      limit: Math.min(maxChunks * 3, MAX_VECTOR_RESULTS),
    })

    const selectedRows = applyPerMessageLimit(
      rankedRows,
      maxChunks,
      this.perMessageLimit,
      ragConfig.scoreThreshold,
    )
    const chunks = selectedRows.map(toRetrievedChunk)

    return {
      chunks,
      diagnostics: {
        retriever: this.id,
        query: input.query,
        totalChunks: rankedRows.length,
        selectedChunks: chunks.length,
      },
    }
  }
}
