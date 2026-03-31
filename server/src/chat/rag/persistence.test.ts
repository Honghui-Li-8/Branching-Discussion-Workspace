import { describe, expect, test } from '@jest/globals'
import {
  buildAssistantMessageMetadata,
  buildConversationTurnMetadata,
} from './persistence'

describe('rag persistence helpers', () => {
  test('buildAssistantMessageMetadata preserves existing fields and adds citations', () => {
    expect(
      buildAssistantMessageMetadata({
        existing: {},
        citations: [
          {
            messageId: 'm1',
            nodeId: 'n1',
            chunkIndex: 0,
            excerpt: 'hello',
          },
        ],
      }),
    ).toEqual({
      citations: [
        {
          messageId: 'm1',
          nodeId: 'n1',
          chunkIndex: 0,
          excerpt: 'hello',
        },
      ],
    })
  })

  test('buildAssistantMessageMetadata leaves metadata unchanged when citations are empty', () => {
    expect(
      buildAssistantMessageMetadata({
        existing: {},
        citations: [],
      }),
    ).toEqual({})
  })

  test('buildConversationTurnMetadata stores snapshot and diagnostics additively', () => {
    const snapshot = {
      id: 'snapshot-1',
      chunks: [],
      totalTokenCount: 0,
      createdAt: '2026-03-31T01:00:00.000Z',
    }

    expect(
      buildConversationTurnMetadata({
        existing: {},
        snapshot,
        diagnostics: {
          retriever: 'vector_v1',
          totalChunks: 3,
          selectedChunks: 2,
        },
      }),
    ).toEqual({
      contextSnapshotId: 'snapshot-1',
      contextSnapshot: snapshot,
      retrievalDiagnostics: {
        retriever: 'vector_v1',
        totalChunks: 3,
        selectedChunks: 2,
      },
    })
  })
})
