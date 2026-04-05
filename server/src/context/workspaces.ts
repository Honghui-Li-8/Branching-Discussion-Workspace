import type { AppRouterContext } from '@branching/shared'
import {
  createWorkspaceForAuthor as createWorkspaceForAuthorRecord,
  deleteWorkspaceForAuthor as deleteWorkspaceForAuthorRecord,
  listWorkspacesByAuthor as listWorkspacesByAuthorRecord,
  updateWorkspaceForAuthor as updateWorkspaceForAuthorRecord,
} from '../db/index.js'
import { workspaceExists as workspaceExistsRecord } from '../db/queries/internal.js'
import type { ContextOwnershipHelpers } from './types.js'

type WorkspaceHandlers = Pick<
  AppRouterContext,
  'listWorkspaces' | 'getWorkspaceById' | 'createWorkspace' | 'updateWorkspace' | 'deleteWorkspace'
>

export const createWorkspaceHandlers = ({
  requireSessionUserId,
  resolveOwnedRecordOrNull,
  getWorkspaceByIdForSessionUser,
}: Pick<
  ContextOwnershipHelpers,
  'requireSessionUserId' | 'resolveOwnedRecordOrNull' | 'getWorkspaceByIdForSessionUser'
>): WorkspaceHandlers => ({
  listWorkspaces: async () => listWorkspacesByAuthorRecord(requireSessionUserId()),
  getWorkspaceById: async (id) => getWorkspaceByIdForSessionUser(id),
  createWorkspace: async (input) => {
    const currentUserId = requireSessionUserId()
    return createWorkspaceForAuthorRecord({
      ...input,
      authorUserId: currentUserId,
    })
  },
  updateWorkspace: async (input) => {
    const currentUserId = requireSessionUserId()
    return resolveOwnedRecordOrNull(
      await updateWorkspaceForAuthorRecord(input, currentUserId),
      input.id,
      workspaceExistsRecord,
    )
  },
  deleteWorkspace: async (id) => {
    const currentUserId = requireSessionUserId()
    return resolveOwnedRecordOrNull(
      await deleteWorkspaceForAuthorRecord(id, currentUserId),
      id,
      workspaceExistsRecord,
    )
  },
})
