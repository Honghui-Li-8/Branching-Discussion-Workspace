import { describe, expect, test } from '@jest/globals'
import {
  approveMergeInputSchema,
  approveMergeOutputSchema,
  cancelMergeInputSchema,
  cancelMergeOutputSchema,
  initiateNodeMergeInputSchema,
  initiateNodeMergeOutputSchema,
  reviseMergeProposalInputSchema,
  reviseMergeProposalOutputSchema,
} from './merge.js'

describe('merge router schema contracts', () => {
  test('initiateNodeMerge schemas accept valid input and output', () => {
    expect(initiateNodeMergeInputSchema.parse({ nodeId: 'node-1' })).toEqual({
      nodeId: 'node-1',
    })
    expect(
      initiateNodeMergeOutputSchema.parse({
        proposalMessageId: 'message-1',
        proposedConclusion: 'Use GraphQL for realtime data.',
      }),
    ).toEqual({
      proposalMessageId: 'message-1',
      proposedConclusion: 'Use GraphQL for realtime data.',
    })
  })

  test('reviseMergeProposal accepts edit mode', () => {
    expect(
      reviseMergeProposalInputSchema.parse({
        nodeId: 'node-1',
        proposalMessageId: 'message-1',
        revision: {
          mode: 'edit',
          editedText: 'Use GraphQL for realtime data.',
        },
      }),
    ).toEqual({
      nodeId: 'node-1',
      proposalMessageId: 'message-1',
      revision: {
        mode: 'edit',
        editedText: 'Use GraphQL for realtime data.',
      },
    })
  })

  test('reviseMergeProposal accepts reject mode', () => {
    expect(
      reviseMergeProposalInputSchema.parse({
        nodeId: 'node-1',
        proposalMessageId: 'message-1',
        revision: {
          mode: 'reject',
          revisionInstruction: 'Make the conclusion more specific.',
        },
      }),
    ).toMatchObject({
      revision: {
        mode: 'reject',
        revisionInstruction: 'Make the conclusion more specific.',
      },
    })
  })

  test('reviseMergeProposal rejects empty edit text', () => {
    expect(() =>
      reviseMergeProposalInputSchema.parse({
        nodeId: 'node-1',
        proposalMessageId: 'message-1',
        revision: {
          mode: 'edit',
          editedText: '   ',
        },
      }),
    ).toThrow()
  })

  test('reviseMergeProposal rejects wrong discriminant fields', () => {
    expect(() =>
      reviseMergeProposalInputSchema.parse({
        nodeId: 'node-1',
        proposalMessageId: 'message-1',
        revision: {
          mode: 'edit',
          revisionInstruction: 'wrong field',
        },
      }),
    ).toThrow()
  })

  test('reviseMergeProposal output requires a non-empty conclusion', () => {
    expect(() =>
      reviseMergeProposalOutputSchema.parse({
        proposalMessageId: 'message-1',
        proposedConclusion: '',
      }),
    ).toThrow()
  })

  test('cancelMerge schemas accept cancelled count output', () => {
    expect(cancelMergeInputSchema.parse({ nodeId: 'node-1' })).toEqual({
      nodeId: 'node-1',
    })
    expect(cancelMergeOutputSchema.parse({ cancelledCount: 1 })).toEqual({
      cancelledCount: 1,
    })
  })

  test('cancelMerge output rejects negative counts', () => {
    expect(() => cancelMergeOutputSchema.parse({ cancelledCount: -1 })).toThrow()
  })

  test('approveMerge schemas accept valid ids', () => {
    expect(
      approveMergeInputSchema.parse({
        nodeId: 'node-1',
        proposalMessageId: 'message-1',
      }),
    ).toEqual({
      nodeId: 'node-1',
      proposalMessageId: 'message-1',
    })
    expect(approveMergeOutputSchema.parse({ parentMessageId: 'message-parent' })).toEqual({
      parentMessageId: 'message-parent',
    })
  })
})
