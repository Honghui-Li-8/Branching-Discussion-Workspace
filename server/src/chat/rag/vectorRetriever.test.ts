import { describe, expect, jest, test } from '@jest/globals'
import type { ScoredMessageRetrievalChunkRecord } from '../../db/models/messageRetrievalChunk.js'
import { buildCitationsFromChunks, VectorRetrieverV1 } from './vectorRetriever'

const scoredChunk = (
  overrides: Partial<ScoredMessageRetrievalChunkRecord> = {},
): ScoredMessageRetrievalChunkRecord => ({
  id: 'chunk-1',
  messageId: 'm1',
  nodeId: 'n1',
  authorUserId: 'u1',
  chunkIndex: 0,
  content: 'hello world',
  tokenCount: 3,
  score: 0.95,
  createdAt: '2026-03-31T00:00:00.000Z',
  updatedAt: '2026-03-31T00:00:00.000Z',
  ...overrides,
})

describe('VectorRetrieverV1', () => {
  test('returns top scored chunks within threshold and per-message limit', async () => {
    const retriever = new VectorRetrieverV1(
      {
        createEmbedder: () => ({
          id: 'openai',
          embed: async () => [[0.1, 0.2]],
        }),
        searchMessageRetrievalChunks: jest.fn(async () => [
          scoredChunk({ messageId: 'm1', chunkIndex: 0, score: 0.95 }),
          scoredChunk({ messageId: 'm1', chunkIndex: 1, score: 0.94 }),
          scoredChunk({ messageId: 'm1', chunkIndex: 2, score: 0.93 }),
          scoredChunk({ messageId: 'm2', chunkIndex: 0, score: 0.92 }),
          scoredChunk({ messageId: 'm3', chunkIndex: 0, score: 0.2 }),
        ]),
        getRagConfig: () => ({
          enabled: true,
          retriever: 'vector_v1',
          embeddingModel: 'text-embedding-3-small',
          maxChunks: 3,
          maxRetrievalTokens: 1200,
          scoreThreshold: 0.5,
          allowedUserIds: [],
          allowedWorkspaceIds: [],
        }),
      },
      { perMessageLimit: 2 },
    )

    const result = await retriever.retrieve({
      query: 'hello',
      nodeId: 'n1',
      authorUserId: 'u1',
    })

    expect(result).toEqual({
      chunks: [
        {
          messageId: 'm1',
          nodeId: 'n1',
          chunkIndex: 0,
          content: 'hello world',
          tokenCount: 3,
          score: 0.95,
        },
        {
          messageId: 'm1',
          nodeId: 'n1',
          chunkIndex: 1,
          content: 'hello world',
          tokenCount: 3,
          score: 0.94,
        },
        {
          messageId: 'm2',
          nodeId: 'n1',
          chunkIndex: 0,
          content: 'hello world',
          tokenCount: 3,
          score: 0.92,
        },
      ],
      diagnostics: {
        retriever: 'vector_v1',
        query: 'hello',
        totalChunks: 5,
        selectedChunks: 3,
      },
    })
  })

  test('buildCitationsFromChunks maps retrieved chunks into citations', () => {
    expect(
      buildCitationsFromChunks([
        {
          messageId: 'm1',
          nodeId: 'n1',
          chunkIndex: 0,
          content: 'hello world',
          score: 0.95,
        },
      ]),
    ).toEqual([
      {
        messageId: 'm1',
        nodeId: 'n1',
        chunkIndex: 0,
        excerpt: 'hello world',
        score: 0.95,
      },
    ])
  })
})
