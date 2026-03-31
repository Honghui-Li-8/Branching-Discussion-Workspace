import { describe, expect, test } from '@jest/globals'
import { applyContextPolicy } from './contextPolicy'

const ragConfig = {
  enabled: true,
  retriever: 'vector_v1' as const,
  embeddingModel: 'text-embedding-3-small',
  maxChunks: 2,
  maxRetrievalTokens: 10,
  scoreThreshold: 0,
  allowedUserIds: [],
  allowedWorkspaceIds: [],
}

describe('applyContextPolicy', () => {
  test('clips by maxChunks and token budget deterministically', () => {
    const decision = applyContextPolicy(
      {
        chunks: [
          {
            messageId: 'm1',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'alpha',
            tokenCount: 3,
            score: 0.9,
          },
          {
            messageId: 'm2',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'beta',
            tokenCount: 4,
            score: 0.8,
          },
          {
            messageId: 'm3',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'gamma',
            tokenCount: 4,
            score: 0.7,
          },
        ],
        diagnostics: {
          retriever: 'vector_v1',
          totalChunks: 3,
        },
      },
      {
        config: ragConfig,
        safetyMarginTokens: 2,
        now: new Date('2026-03-31T01:00:00.000Z'),
      },
    )

    expect(decision).toEqual({
      selectedChunks: [
        {
          messageId: 'm1',
          nodeId: 'n1',
          chunkIndex: 0,
          content: 'alpha',
          tokenCount: 3,
          score: 0.9,
        },
          {
          messageId: 'm2',
          nodeId: 'n1',
          chunkIndex: 0,
          content: 'beta',
          tokenCount: 4,
          score: 0.8,
        },
      ],
      citations: [
        {
          messageId: 'm1',
          nodeId: 'n1',
          chunkIndex: 0,
          excerpt: 'alpha',
          score: 0.9,
        },
        {
          messageId: 'm2',
          nodeId: 'n1',
          chunkIndex: 0,
          excerpt: 'beta',
          score: 0.8,
        },
      ],
      snapshot: {
        id: expect.any(String),
        chunks: [
          {
            messageId: 'm1',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'alpha',
            tokenCount: 3,
            score: 0.9,
          },
          {
            messageId: 'm2',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'beta',
            tokenCount: 4,
            score: 0.8,
          },
        ],
        totalTokenCount: 7,
        createdAt: '2026-03-31T01:00:00.000Z',
      },
      diagnostics: {
        retriever: 'vector_v1',
        totalChunks: 3,
        selectedChunks: 2,
      },
    })
  })

  test('keeps the first chunk even when it exceeds the reduced budget', () => {
    const decision = applyContextPolicy(
      {
        chunks: [
          {
            messageId: 'm1',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'oversized',
            tokenCount: 20,
          },
        ],
      },
      {
        config: {
          ...ragConfig,
          maxChunks: 1,
          maxRetrievalTokens: 10,
        },
        safetyMarginTokens: 5,
      },
    )

    expect(decision.selectedChunks).toHaveLength(1)
    expect(decision.snapshot.totalTokenCount).toBe(20)
  })
})
