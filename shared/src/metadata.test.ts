import {
  parseConversationTurnMetadata,
  parseMessageMetadata,
  parseBranchEventMetadata,
  parseMergeEventMetadata,
  parseMergeProposalMetadata,
  serializeBranchEventMetadata,
  serializeConversationTurnMetadata,
  serializeMergeEventMetadata,
  serializeMergeProposalMetadata,
  serializeMessageMetadata,
  retrieverInputSchema,
  branchEventMetadataSchema,
  mergeEventMetadataSchema,
  mergeProposalMetadataSchema,
  isStructuralMessageMetadata,
} from './metadata.js'
import { STRUCTURAL_MESSAGE_TYPES } from './messageTypes.js'

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

  test('parseBranchEventMetadata returns payload for valid branch event', () => {
    expect(
      parseBranchEventMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: 'node-1',
        sourceMessageId: 'msg-1',
        branchNodeId: 'branch-node-1',
      }),
    ).toEqual({
      eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
      sourceNodeId: 'node-1',
      sourceMessageId: 'msg-1',
      branchNodeId: 'branch-node-1',
    })
  })

  test('parseBranchEventMetadata includes optional fields when present', () => {
    expect(
      parseBranchEventMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: 'node-1',
        sourceMessageId: 'msg-1',
        sourceAnnotationId: 'ann-1',
        sourceContext: 'some surrounding text',
        branchNodeId: 'branch-node-1',
      }),
    ).toEqual({
      eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
      sourceNodeId: 'node-1',
      sourceMessageId: 'msg-1',
      sourceAnnotationId: 'ann-1',
      sourceContext: 'some surrounding text',
      branchNodeId: 'branch-node-1',
    })
  })

  test('parseBranchEventMetadata returns null when eventType is missing', () => {
    expect(
      parseBranchEventMetadata({
        sourceNodeId: 'node-1',
        sourceMessageId: 'msg-1',
        branchNodeId: 'branch-node-1',
      }),
    ).toBeNull()
  })

  test('parseBranchEventMetadata returns null when required fields are missing', () => {
    expect(
      parseBranchEventMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: 'node-1',
      }),
    ).toBeNull()
  })

  test('parseBranchEventMetadata returns null for wrong eventType', () => {
    expect(
      parseBranchEventMetadata({
        eventType: 'other_event',
        sourceNodeId: 'node-1',
        sourceMessageId: 'msg-1',
        branchNodeId: 'branch-node-1',
      }),
    ).toBeNull()
  })

  test('parseMessageMetadata includes branch event fields when present', () => {
    expect(
      parseMessageMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: 'node-1',
        sourceMessageId: 'msg-1',
        branchNodeId: 'branch-node-1',
      }),
    ).toEqual({
      eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
      sourceNodeId: 'node-1',
      sourceMessageId: 'msg-1',
      branchNodeId: 'branch-node-1',
    })
  })

  test('branchEventMetadataSchema rejects empty string ids', () => {
    expect(() =>
      branchEventMetadataSchema.parse({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: '',
        sourceMessageId: 'msg-1',
        branchNodeId: 'branch-node-1',
      }),
    ).toThrow()
  })

  test('serializeBranchEventMetadata accepts a complete valid payload', () => {
    const input = {
      eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
      sourceNodeId: 'node-1',
      sourceMessageId: 'msg-1',
      branchNodeId: 'branch-node-1',
    }
    expect(serializeBranchEventMetadata(input)).toEqual(input)
  })

  test('serializeBranchEventMetadata throws on partial branch event payload', () => {
    expect(() =>
      serializeBranchEventMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: 'node-1',
      } as never),
    ).toThrow()
  })

  test('parseMergeProposalMetadata returns payload for valid merge proposal', () => {
    expect(
      parseMergeProposalMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
        proposalId: 'proposal-1',
        proposedConclusion: 'Use GraphQL for realtime data.',
        mergeStatus: 'pending',
        revisionRound: 1,
      }),
    ).toEqual({
      eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
      proposalId: 'proposal-1',
      proposedConclusion: 'Use GraphQL for realtime data.',
      mergeStatus: 'pending',
      revisionRound: 1,
    })
  })

  test('parseMergeProposalMetadata returns null for wrong event type', () => {
    expect(
      parseMergeProposalMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
        proposalId: 'proposal-1',
        proposedConclusion: 'Use GraphQL for realtime data.',
        mergeStatus: 'pending',
        revisionRound: 1,
      }),
    ).toBeNull()
  })

  test('mergeProposalMetadataSchema rejects empty conclusions', () => {
    expect(() =>
      mergeProposalMetadataSchema.parse({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
        proposalId: 'proposal-1',
        proposedConclusion: '   ',
        mergeStatus: 'pending',
        revisionRound: 1,
      }),
    ).toThrow()
  })

  test('serializeMergeProposalMetadata accepts all proposal statuses', () => {
    for (const mergeStatus of ['pending', 'approved', 'superseded', 'cancelled'] as const) {
      const input = {
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
        proposalId: `proposal-${mergeStatus}`,
        proposedConclusion: 'Use GraphQL for realtime data.',
        mergeStatus,
        revisionRound: 1,
      }
      expect(serializeMergeProposalMetadata(input)).toEqual(input)
    }
  })

  test('parseMergeEventMetadata returns payload for valid merge event', () => {
    expect(
      parseMergeEventMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
        sourceNodeId: 'branch-node-1',
        sourceBranchTitle: 'Realtime API choice',
        sourceBranchOriginMessageId: 'parent-message-1',
        conclusion: 'Use GraphQL for realtime data.',
        mergedAt: '2026-04-26T00:00:00.000Z',
      }),
    ).toEqual({
      eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
      sourceNodeId: 'branch-node-1',
      sourceBranchTitle: 'Realtime API choice',
      sourceBranchOriginMessageId: 'parent-message-1',
      conclusion: 'Use GraphQL for realtime data.',
      mergedAt: '2026-04-26T00:00:00.000Z',
    })
  })

  test('mergeEventMetadataSchema rejects invalid mergedAt value', () => {
    expect(() =>
      mergeEventMetadataSchema.parse({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
        sourceNodeId: 'branch-node-1',
        sourceBranchTitle: 'Realtime API choice',
        sourceBranchOriginMessageId: 'parent-message-1',
        conclusion: 'Use GraphQL for realtime data.',
        mergedAt: 'not-a-date',
      }),
    ).toThrow()
  })

  test('serializeMergeEventMetadata rejects empty source ids', () => {
    expect(() =>
      serializeMergeEventMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
        sourceNodeId: '',
        sourceBranchTitle: 'Realtime API choice',
        sourceBranchOriginMessageId: 'parent-message-1',
        conclusion: 'Use GraphQL for realtime data.',
        mergedAt: '2026-04-26T00:00:00.000Z',
      }),
    ).toThrow()
  })

  test('parseMessageMetadata includes merge proposal fields when present', () => {
    expect(
      parseMessageMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
        proposalId: 'proposal-1',
        proposedConclusion: 'Use GraphQL for realtime data.',
        mergeStatus: 'pending',
        revisionRound: 1,
      }),
    ).toEqual({
      eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
      proposalId: 'proposal-1',
      proposedConclusion: 'Use GraphQL for realtime data.',
      mergeStatus: 'pending',
      revisionRound: 1,
    })
  })

  test('parseMessageMetadata includes merge event fields when present', () => {
    expect(
      parseMessageMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
        sourceNodeId: 'branch-node-1',
        sourceBranchTitle: 'Realtime API choice',
        sourceBranchOriginMessageId: 'parent-message-1',
        conclusion: 'Use GraphQL for realtime data.',
        mergedAt: '2026-04-26T00:00:00.000Z',
      }),
    ).toEqual({
      eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
      sourceNodeId: 'branch-node-1',
      sourceBranchTitle: 'Realtime API choice',
      sourceBranchOriginMessageId: 'parent-message-1',
      conclusion: 'Use GraphQL for realtime data.',
      mergedAt: '2026-04-26T00:00:00.000Z',
    })
  })
})

describe('isStructuralMessageMetadata', () => {
  test('returns true for valid branch event metadata', () => {
    expect(
      isStructuralMessageMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: 'node-1',
        sourceMessageId: 'msg-1',
        branchNodeId: 'branch-node-1',
      }),
    ).toBe(true)
  })

  test('returns true for valid merge proposal metadata', () => {
    expect(
      isStructuralMessageMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
        proposalId: 'proposal-1',
        proposedConclusion: 'Use GraphQL.',
        mergeStatus: 'pending',
        revisionRound: 1,
      }),
    ).toBe(true)
  })

  test('returns true for valid merge event metadata', () => {
    expect(
      isStructuralMessageMetadata({
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
        sourceNodeId: 'branch-node-1',
        sourceBranchTitle: 'API choice',
        sourceBranchOriginMessageId: 'parent-msg-1',
        conclusion: 'Use GraphQL.',
        mergedAt: '2026-04-26T00:00:00.000Z',
      }),
    ).toBe(true)
  })

  test('returns false for unknown eventType', () => {
    expect(isStructuralMessageMetadata({ eventType: 'some_other_event' })).toBe(false)
  })

  test('returns false when eventType field is missing', () => {
    expect(isStructuralMessageMetadata({ sourceNodeId: 'node-1' })).toBe(false)
  })

  test('returns false for null', () => {
    expect(isStructuralMessageMetadata(null)).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isStructuralMessageMetadata(undefined)).toBe(false)
  })
})
