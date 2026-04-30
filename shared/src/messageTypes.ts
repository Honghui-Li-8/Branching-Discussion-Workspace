export const STRUCTURAL_MESSAGE_TYPES = {
  branchEvent: 'branch_event',
  mergeProposal: 'merge_proposal',
  mergeEvent: 'merge_event',
} as const

export type StructuralMessageType =
  (typeof STRUCTURAL_MESSAGE_TYPES)[keyof typeof STRUCTURAL_MESSAGE_TYPES]
