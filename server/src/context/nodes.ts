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
import { createLogger } from '../logging/logger.js'
import type { ContextOwnershipHelpers } from './types.js'

type NodeHandlers = Pick<
  AppRouterContext,
  'listNodesByWorkspace' | 'getNodeById' | 'createNode' | 'updateNode' | 'deleteNode'
>

const logger = createLogger('trpc-context')

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
    try {
      const workspace = await getWorkspaceByIdForSessionUser(workspaceId)
      if (!workspace) {
        return []
      }

      return await listNodesByWorkspaceForAuthorRecord(workspaceId, currentUserId)
    } catch (error) {
      logger.error('[node] list-by-workspace request failed.', {
        workspace_id: workspaceId,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[node] list-by-workspace request debug error details.', {
        workspace_id: workspaceId,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  getNodeById: async (id) => {
    const currentUserId = requireSessionUserId()
    try {
      return await getNodeByIdForSessionUser(id)
    } catch (error) {
      logger.error('[node] get-by-id request failed.', {
        node_id: id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[node] get-by-id request debug error details.', {
        node_id: id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  createNode: async (input) => {
    const currentUserId = requireSessionUserId()
    try {
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
    } catch (error) {
      logger.error('[node] create request failed.', {
        workspace_id: input.workspaceId,
        parent_node_id: input.parentNodeId,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[node] create request debug error details.', {
        workspace_id: input.workspaceId,
        parent_node_id: input.parentNodeId,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  updateNode: async (input) => {
    const currentUserId = requireSessionUserId()
    try {
      return await resolveOwnedRecordOrNull(
        await updateNodeForAuthorRecord(input, currentUserId),
        input.id,
        nodeExistsRecord,
      )
    } catch (error) {
      logger.error('[node] update request failed.', {
        node_id: input.id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[node] update request debug error details.', {
        node_id: input.id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  deleteNode: async (id) => {
    const currentUserId = requireSessionUserId()
    try {
      return await resolveOwnedRecordOrNull(
        await deleteNodeForAuthorRecord(id, currentUserId),
        id,
        nodeExistsRecord,
      )
    } catch (error) {
      logger.error('[node] delete request failed.', {
        node_id: id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[node] delete request debug error details.', {
        node_id: id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
})
