import type { AppRouterContext } from '@branching/shared'
import {
  createWorkspaceForAuthor as createWorkspaceForAuthorRecord,
  deleteWorkspaceForAuthor as deleteWorkspaceForAuthorRecord,
  listWorkspacesByAuthor as listWorkspacesByAuthorRecord,
  updateWorkspaceForAuthor as updateWorkspaceForAuthorRecord,
} from '../db/index.js'
import { workspaceExists as workspaceExistsRecord } from '../db/queries/workspace.js'
import { createLogger } from '../logging/logger.js'
import type { ContextOwnershipHelpers } from './types.js'

type WorkspaceHandlers = Pick<
  AppRouterContext,
  'listWorkspaces' | 'getWorkspaceById' | 'createWorkspace' | 'updateWorkspace' | 'deleteWorkspace'
>

const logger = createLogger('trpc-context')

export const createWorkspaceHandlers = ({
  requireSessionUserId,
  resolveOwnedRecordOrNull,
  getWorkspaceByIdForSessionUser,
}: Pick<
  ContextOwnershipHelpers,
  'requireSessionUserId' | 'resolveOwnedRecordOrNull' | 'getWorkspaceByIdForSessionUser'
>): WorkspaceHandlers => ({
  listWorkspaces: async () => {
    const currentUserId = requireSessionUserId()
    try {
      return await listWorkspacesByAuthorRecord(currentUserId)
    } catch (error) {
      logger.error('[workspace] list request failed.', {
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[workspace] list request debug error details.', {
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  getWorkspaceById: async (id) => {
    const currentUserId = requireSessionUserId()
    try {
      return await getWorkspaceByIdForSessionUser(id)
    } catch (error) {
      logger.error('[workspace] get-by-id request failed.', {
        workspace_id: id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[workspace] get-by-id request debug error details.', {
        workspace_id: id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  createWorkspace: async (input) => {
    const currentUserId = requireSessionUserId()
    try {
      return await createWorkspaceForAuthorRecord({
        ...input,
        authorUserId: currentUserId,
      })
    } catch (error) {
      logger.error('[workspace] create request failed.', {
        title: input.title,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[workspace] create request debug error details.', {
        title: input.title,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  updateWorkspace: async (input) => {
    const currentUserId = requireSessionUserId()
    try {
      return await resolveOwnedRecordOrNull(
        await updateWorkspaceForAuthorRecord(input, currentUserId),
        input.id,
        workspaceExistsRecord,
      )
    } catch (error) {
      logger.error('[workspace] update request failed.', {
        workspace_id: input.id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[workspace] update request debug error details.', {
        workspace_id: input.id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  deleteWorkspace: async (id) => {
    const currentUserId = requireSessionUserId()
    try {
      return await resolveOwnedRecordOrNull(
        await deleteWorkspaceForAuthorRecord(id, currentUserId),
        id,
        workspaceExistsRecord,
      )
    } catch (error) {
      logger.error('[workspace] delete request failed.', {
        workspace_id: id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[workspace] delete request debug error details.', {
        workspace_id: id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
})
