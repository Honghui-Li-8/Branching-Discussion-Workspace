import {
  parseConversationTurnMetadata,
  parseMessageMetadata,
  serializeConversationTurnMetadata,
  serializeMessageMetadata,
  retrieverInputSchema,
} from './metadata.js'

describe('metadata contracts', () => {
  test('parseMessageMetadata returns normalized citations payload', () => {
    expect(
      parseMessageMetadata({
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

  test('parseMessageMetadata drops invalid payloads to empty object', () => {
    expect(
      parseMessageMetadata({
        citations: [{ messageId: 'm1' }],
      }),
    ).toEqual({})
  })

  test('serializeMessageMetadata defaults undefined to empty object', () => {
    expect(serializeMessageMetadata(undefined)).toEqual({})
  })

  test('parseConversationTurnMetadata returns normalized snapshot payload', () => {
    expect(
      parseConversationTurnMetadata({
        contextSnapshotId: 'snapshot-1',
        retrievalDiagnostics: {
          retriever: 'noop',
          totalChunks: 0,
        },
      }),
    ).toEqual({
      contextSnapshotId: 'snapshot-1',
      retrievalDiagnostics: {
        retriever: 'noop',
        totalChunks: 0,
      },
    })
  })

  test('serializeConversationTurnMetadata rejects invalid shapes', () => {
    expect(() =>
      serializeConversationTurnMetadata({
        contextSnapshotId: '',
      }),
    ).toThrow()
  })

  test('retrieverInputSchema validates required retriever input shape', () => {
    expect(
      retrieverInputSchema.parse({
        query: 'hello',
        nodeId: 'n1',
        authorUserId: 'u1',
      }),
    ).toEqual({
      query: 'hello',
      nodeId: 'n1',
      authorUserId: 'u1',
    })
  })
})
