import type { AppRouterContext } from '@branching/shared'
import {
  approveMerge,
  cancelMerge,
  initiateNodeMerge,
  reviseMergeProposal,
} from '../merge/mergeNodeToParent.js'
import type { ContextOwnershipHelpers } from './types.js'

type MergeHandlers = Pick<
  AppRouterContext,
  'initiateNodeMerge' | 'reviseMergeProposal' | 'cancelMerge' | 'approveMerge'
>

export const createMergeHandlers = ({
  requireSessionUserId,
}: Pick<ContextOwnershipHelpers, 'requireSessionUserId'>): MergeHandlers => ({
  initiateNodeMerge: async (input) =>
    initiateNodeMerge({
      input,
      currentUserId: requireSessionUserId(),
    }),
  reviseMergeProposal: async (input) =>
    reviseMergeProposal({
      input,
      currentUserId: requireSessionUserId(),
    }),
  cancelMerge: async (input) =>
    cancelMerge({
      input,
      currentUserId: requireSessionUserId(),
    }),
  approveMerge: async (input) =>
    approveMerge({
      input,
      currentUserId: requireSessionUserId(),
    }),
})
