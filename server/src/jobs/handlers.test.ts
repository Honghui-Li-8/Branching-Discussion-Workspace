import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import type {
  ConversationPostprocessJobRecord,
  ConversationTurnRecord,
  MessageRecord,
  MessageRetrievalChunkRecord,
  UpsertMessageRetrievalChunkInput,
} from '../db/models/index.js'
import { InMemoryJobMetrics } from './metrics'
import { createIndexTurnHandler } from './handlers'

const baseJob: ConversationPostprocessJobRecord = {
  id: 'job-1',
  turnId: 'turn-1',
  jobType: 'index',
  payload: {},
  status: 'running',
  attemptCount: 0,
  maxAttempts: 5,
  runAfter: '2026-03-31T00:00:00.000Z',
  lastError: null,
  leasedAt: '2026-03-31T00:00:05.000Z',
  leaseOwner: 'worker-1',
  finishedAt: null,
  createdAt: '2026-03-31T00:00:00.000Z',
  updatedAt: '2026-03-31T00:00:00.000Z',
}

const turn: ConversationTurnRecord = {
  id: 'turn-1',
  nodeId: 'n1',
  authorUserId: 'u1',
  status: 'completed',
  model: 'gpt-5',
  idempotencyKey: 'idem-1',
  error: null,
  completedAt: '2026-03-31T00:00:10.000Z',
  metadata: {},
  createdAt: '2026-03-31T00:00:00.000Z',
  updatedAt: '2026-03-31T00:00:10.000Z',
}

const message: MessageRecord = {
  id: 'm1',
  authorUserId: 'u1',
  nodeId: 'n1',
  turnId: 'turn-1',
  role: 'assistant',
  content: 'hello world from the assistant',
  metadata: {},
  createdAt: '2026-03-31T00:00:09.000Z',
}

const indexedChunk: MessageRetrievalChunkRecord = {
  id: 'chunk-1',
  messageId: 'm1',
  nodeId: 'n1',
  authorUserId: 'u1',
  chunkIndex: 0,
  content: 'hello world from the assistant',
  tokenCount: 8,
  createdAt: '2026-03-31T00:00:11.000Z',
  updatedAt: '2026-03-31T00:00:11.000Z',
}

const createDeps = () => ({
  metrics: new InMemoryJobMetrics(),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  now: jest.fn(() => 2_000),
  getConversationTurnById: jest.fn(async (_id: string) => turn as ConversationTurnRecord | null),
  listMessagesByTurn: jest.fn(async (_turnId: string) => [message]),
  upsertMessageRetrievalChunk: jest.fn(
    async (_input: UpsertMessageRetrievalChunkInput) => indexedChunk,
  ),
  createEmbedder: jest.fn(() => ({
    id: 'openai',
    embed: jest.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2])),
  })),
  getRagConfig: jest.fn(() => ({
    enabled: true,
    retriever: 'vector_v1' as const,
    embeddingModel: 'text-embedding-3-small',
    maxChunks: 4,
    maxRetrievalTokens: 1200,
    scoreThreshold: 0,
    allowedUserIds: [],
    allowedWorkspaceIds: [],
  })),
})

describe('indexTurn handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('skips indexing when rag is disabled', async () => {
    const deps = createDeps()
    deps.getRagConfig.mockReturnValueOnce({
      enabled: false,
      retriever: 'vector_v1',
      embeddingModel: 'text-embedding-3-small',
      maxChunks: 4,
      maxRetrievalTokens: 1200,
      scoreThreshold: 0,
      allowedUserIds: [],
      allowedWorkspaceIds: [],
    })

    await createIndexTurnHandler(deps)(baseJob)

    expect(deps.getConversationTurnById).not.toHaveBeenCalled()
    expect(deps.upsertMessageRetrievalChunk).not.toHaveBeenCalled()
    expect(deps.metrics.snapshot().counters['rag.indexing_completed_total{result=skipped,retriever=vector_v1}']).toBe(1)
    expect(deps.logger.warn).toHaveBeenCalledWith(
      '[rag] indexing skipped.',
      expect.objectContaining({
        job_id: 'job-1',
        turn_id: 'turn-1',
        reason: 'rag_disabled',
      }),
    )
  })

  test('indexes turn-linked messages into retrieval chunks', async () => {
    const deps = createDeps()

    await createIndexTurnHandler(deps)(baseJob)

    expect(deps.getConversationTurnById).toHaveBeenCalledWith('turn-1')
    expect(deps.listMessagesByTurn).toHaveBeenCalledWith('turn-1')
    expect(deps.createEmbedder).toHaveBeenCalledTimes(1)
    expect(deps.upsertMessageRetrievalChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'm1',
        nodeId: 'n1',
        authorUserId: 'u1',
        chunkIndex: 0,
        content: 'hello world from the assistant',
        embedding: [0.1, 0.2],
      }),
    )
    expect(deps.metrics.snapshot().counters['rag.indexing_completed_total{result=success,retriever=vector_v1}']).toBe(1)
    expect(deps.logger.info).toHaveBeenCalledWith(
      '[rag] indexing completed.',
      expect.objectContaining({
        job_id: 'job-1',
        turn_id: 'turn-1',
        node_id: 'n1',
        author_user_id: 'u1',
      }),
    )
  })

  test('returns cleanly when turn no longer exists', async () => {
    const deps = createDeps()
    deps.getConversationTurnById.mockResolvedValueOnce(null)

    await createIndexTurnHandler(deps)(baseJob)

    expect(deps.listMessagesByTurn).not.toHaveBeenCalled()
    expect(deps.upsertMessageRetrievalChunk).not.toHaveBeenCalled()
    expect(deps.metrics.snapshot().counters['rag.indexing_completed_total{result=skipped,retriever=vector_v1}']).toBe(1)
  })

  test('records failure telemetry before rethrowing indexing errors', async () => {
    const deps = createDeps()
    deps.createEmbedder.mockReturnValueOnce({
      id: 'openai',
      embed: jest.fn(async () => []),
    })

    await expect(createIndexTurnHandler(deps)(baseJob)).rejects.toThrow(
      'Embedding count mismatch for indexed chunks.',
    )

    expect(deps.metrics.snapshot().counters['rag.indexing_completed_total{result=failed,retriever=vector_v1}']).toBe(1)
    expect(deps.logger.error).toHaveBeenCalledWith(
      '[rag] indexing failed.',
      expect.objectContaining({
        job_id: 'job-1',
        turn_id: 'turn-1',
        node_id: 'n1',
        author_user_id: 'u1',
        reason: 'Embedding count mismatch for indexed chunks.',
      }),
    )
  })
})
