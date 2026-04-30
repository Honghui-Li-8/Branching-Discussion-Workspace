import type { MergeProposalMetadata } from '@branching/shared'

export const MERGE_ERROR_INVALID_PROPOSAL = 'INVALID_PROPOSAL'
export const MERGE_ERROR_NODE_IS_MERGED = 'NODE_IS_MERGED'
export const MERGE_ERROR_EMPTY_CONCLUSION = 'EMPTY_MERGE_CONCLUSION'

export type MergeErrorKind = 'invalid_proposal' | 'node_is_merged' | 'empty_conclusion' | 'retriable'

export const classifyMergeError = (message: string): MergeErrorKind => {
  if (message === MERGE_ERROR_INVALID_PROPOSAL) return 'invalid_proposal'
  if (message === MERGE_ERROR_NODE_IS_MERGED) return 'node_is_merged'
  if (message === MERGE_ERROR_EMPTY_CONCLUSION) return 'empty_conclusion'
  return 'retriable'
}

export const shouldRenderMergeProposalCard = (metadata: MergeProposalMetadata | null): boolean => {
  if (!metadata) return false
  return metadata.mergeStatus !== 'superseded' && metadata.mergeStatus !== 'cancelled'
}

export const isMergeProposalApproved = (metadata: MergeProposalMetadata | null): boolean =>
  metadata?.mergeStatus === 'approved'

export const isMergeProposalPending = (metadata: MergeProposalMetadata | null): boolean =>
  metadata?.mergeStatus === 'pending'
