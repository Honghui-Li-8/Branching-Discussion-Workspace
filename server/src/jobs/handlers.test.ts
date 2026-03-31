import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import type {
  ConversationPostprocessJobRecord,
  ConversationTurnRecord,
  MessageRecord,
  MessageRetrievalChunkRecord,
  UpsertMessageRetrievalChunkInput,
} from '../db/models/index.js'
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
  })

  test('returns cleanly when turn no longer exists', async () => {
    const deps = createDeps()
    deps.getConversationTurnById.mockResolvedValueOnce(null)

    await createIndexTurnHandler(deps)(baseJob)

    expect(deps.listMessagesByTurn).not.toHaveBeenCalled()
    expect(deps.upsertMessageRetrievalChunk).not.toHaveBeenCalled()
  })
})
