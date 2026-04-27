import { describe, expect, test } from '@jest/globals'
import type { MergeProposalMetadata } from '@branching/shared'
import { STRUCTURAL_MESSAGE_TYPES } from '@branching/shared'
import {
  MERGE_ERROR_EMPTY_CONCLUSION,
  MERGE_ERROR_INVALID_PROPOSAL,
  MERGE_ERROR_NODE_IS_MERGED,
  classifyMergeError,
  isMergeProposalApproved,
  isMergeProposalPending,
  shouldRenderMergeProposalCard,
} from './mergeProposalCardLogic'

const makeMetadata = (mergeStatus: MergeProposalMetadata['mergeStatus']): MergeProposalMetadata => ({
  eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
  proposalId: 'test-id',
  proposedConclusion: 'Test conclusion',
  mergeStatus,
  revisionRound: 1,
})

describe('classifyMergeError', () => {
  test('maps INVALID_PROPOSAL to invalid_proposal', () => {
    expect(classifyMergeError(MERGE_ERROR_INVALID_PROPOSAL)).toBe('invalid_proposal')
  })

  test('maps NODE_IS_MERGED to node_is_merged', () => {
    expect(classifyMergeError(MERGE_ERROR_NODE_IS_MERGED)).toBe('node_is_merged')
  })

  test('maps EMPTY_MERGE_CONCLUSION to empty_conclusion', () => {
    expect(classifyMergeError(MERGE_ERROR_EMPTY_CONCLUSION)).toBe('empty_conclusion')
  })

  test('maps unknown errors to retriable', () => {
    expect(classifyMergeError('INTERNAL_SERVER_ERROR')).toBe('retriable')
    expect(classifyMergeError('Something went wrong')).toBe('retriable')
    expect(classifyMergeError('')).toBe('retriable')
  })
})

describe('shouldRenderMergeProposalCard', () => {
  test('returns false for null metadata', () => {
    expect(shouldRenderMergeProposalCard(null)).toBe(false)
  })

  test('returns false for superseded proposals', () => {
    expect(shouldRenderMergeProposalCard(makeMetadata('superseded'))).toBe(false)
  })

  test('returns false for cancelled proposals', () => {
    expect(shouldRenderMergeProposalCard(makeMetadata('cancelled'))).toBe(false)
  })

  test('returns true for pending proposals', () => {
    expect(shouldRenderMergeProposalCard(makeMetadata('pending'))).toBe(true)
  })

  test('returns true for approved proposals', () => {
    expect(shouldRenderMergeProposalCard(makeMetadata('approved'))).toBe(true)
  })
})

describe('isMergeProposalApproved', () => {
  test('returns true only for approved status', () => {
    expect(isMergeProposalApproved(makeMetadata('approved'))).toBe(true)
  })

  test('returns false for pending, superseded, and cancelled', () => {
    expect(isMergeProposalApproved(makeMetadata('pending'))).toBe(false)
    expect(isMergeProposalApproved(makeMetadata('superseded'))).toBe(false)
    expect(isMergeProposalApproved(makeMetadata('cancelled'))).toBe(false)
  })

  test('returns false for null metadata', () => {
    expect(isMergeProposalApproved(null)).toBe(false)
  })
})

describe('isMergeProposalPending', () => {
  test('returns true only for pending status', () => {
    expect(isMergeProposalPending(makeMetadata('pending'))).toBe(true)
  })

  test('returns false for approved, superseded, and cancelled', () => {
    expect(isMergeProposalPending(makeMetadata('approved'))).toBe(false)
    expect(isMergeProposalPending(makeMetadata('superseded'))).toBe(false)
    expect(isMergeProposalPending(makeMetadata('cancelled'))).toBe(false)
  })

  test('returns false for null metadata', () => {
    expect(isMergeProposalPending(null)).toBe(false)
  })
})
