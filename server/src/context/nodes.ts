import { TRPCError } from '@trpc/server'
import type { AppRouterContext } from '@branching/shared'
import {
  createNodeForAuthor as createNodeForAuthorRecord,
  deleteNodeForAuthor as deleteNodeForAuthorRecord,
  getWorkspaceByIdForAuthor as getWorkspaceByIdForAuthorRecord,
  listNodesByWorkspaceForAuthor as listNodesByWorkspaceForAuthorRecord,
  updateNodeForAuthor as updateNodeForAuthorRecord,
} from '../db/index.js'
import {
  nodeExists as nodeExistsRecord,
  workspaceExists as workspaceExistsRecord,
} from '../db/queries/internal.js'
import type { ContextOwnershipHelpers } from './types.js'

type NodeHandlers = Pick<
  AppRouterContext,
  'listNodesByWorkspace' | 'getNodeById' | 'createNode' | 'updateNode' | 'deleteNode'
>

export const createNodeHandlers = ({
  requireSessionUserId,
  resolveOwnedRecordOrNull,
  resolveOwnedRecordOrNotFound,
  getWorkspaceByIdForSessionUser,
  getNodeByIdForSessionUser,
}: Pick<
  ContextOwnershipHelpers,
  | 'requireSessionUserId'
  | 'resolveOwnedRecordOrNull'
  | 'resolveOwnedRecordOrNotFound'
  | 'getWorkspaceByIdForSessionUser'
  | 'getNodeByIdForSessionUser'
>): NodeHandlers => ({
  listNodesByWorkspace: async (workspaceId) => {
    const currentUserId = requireSessionUserId()
    const workspace = await getWorkspaceByIdForSessionUser(workspaceId)
    if (!workspace) {
      return []
    }

    return listNodesByWorkspaceForAuthorRecord(workspaceId, currentUserId)
  },
  getNodeById: async (id) => getNodeByIdForSessionUser(id),
  createNode: async (input) => {
    const currentUserId = requireSessionUserId()
    await resolveOwnedRecordOrNotFound(
      await getWorkspaceByIdForAuthorRecord(input.workspaceId, currentUserId),
      input.workspaceId,
      workspaceExistsRecord,
      'Workspace not found.',
    )

    const node = await createNodeForAuthorRecord({
      ...input,
      authorUserId: currentUserId,
    })
    if (node === null) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Parent node not found in workspace.',
      })
    }
    return node
  },
  updateNode: async (input) => {
    const currentUserId = requireSessionUserId()
    return resolveOwnedRecordOrNull(
      await updateNodeForAuthorRecord(input, currentUserId),
      input.id,
      nodeExistsRecord,
    )
  },
  deleteNode: async (id) => {
    const currentUserId = requireSessionUserId()
    return resolveOwnedRecordOrNull(
      await deleteNodeForAuthorRecord(id, currentUserId),
      id,
      nodeExistsRecord,
    )
  },
})
