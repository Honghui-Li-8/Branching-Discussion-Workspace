import { TRPCError } from '@trpc/server'
import type { AppRouterContext } from '@branching/shared'
import type { Request } from 'express'
import { getSessionIdFromCookieHeader } from './auth/cookies.js'
import { getSessionUser } from './auth/sessionStore.js'
import {
  getNodeByIdForAuthor as getNodeByIdForAuthorRecord,
  getWorkspaceByIdForAuthor as getWorkspaceByIdForAuthorRecord,
} from './db/index.js'
import {
  nodeExists as nodeExistsRecord,
  workspaceExists as workspaceExistsRecord,
} from './db/queries/internal.js'
import { createAnnotationHandlers } from './context/annotations.js'
import { createConversationHandlers } from './context/conversation.js'
import { createMessageHandlers } from './context/messages.js'
import { createNodeHandlers } from './context/nodes.js'
import type { ExistsById } from './context/types.js'
import { createUserHandlers } from './context/users.js'
import { createWorkspaceHandlers } from './context/workspaces.js'

type ContextRequest = Pick<Request, 'headers'>

export const createAppRouterContext = (req: ContextRequest): AppRouterContext => {
  const sessionId = getSessionIdFromCookieHeader(req.headers.cookie)
  const sessionUserId = sessionId ? getSessionUser(sessionId)?.id ?? null : null

  const requireSessionUserId = (): string => {
    if (!sessionUserId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      })
    }
    return sessionUserId
  }

  const throwWorkspaceForbidden = (): never => {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Workspace access is forbidden.',
    })
  }

  const throwNotFound = (message: string): never => {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message,
    })
  }

  const resolveOwnedRecordOrNull = async <T>(
    record: T | null,
    resourceId: string,
    existsById: ExistsById,
  ): Promise<T | null> => {
    if (record) {
      return record
    }

    if (await existsById(resourceId)) {
      throwWorkspaceForbidden()
    }

    return null
  }

  const resolveOwnedRecordOrNotFound = async <T>(
    record: T | null,
    resourceId: string,
    existsById: ExistsById,
    notFoundMessage: string,
  ): Promise<T> => {
    const resolvedRecord = await resolveOwnedRecordOrNull(record, resourceId, existsById)
    if (resolvedRecord) {
      return resolvedRecord
    }

    return throwNotFound(notFoundMessage)
  }

  const getWorkspaceByIdForSessionUser = async (workspaceId: string) => {
    const currentUserId = requireSessionUserId()
    return resolveOwnedRecordOrNull(
      await getWorkspaceByIdForAuthorRecord(workspaceId, currentUserId),
      workspaceId,
      workspaceExistsRecord,
    )
  }

  const getNodeByIdForSessionUser = async (nodeId: string) => {
    const currentUserId = requireSessionUserId()
    return resolveOwnedRecordOrNull(
      await getNodeByIdForAuthorRecord(nodeId, currentUserId),
      nodeId,
      nodeExistsRecord,
    )
  }

  return {
    sessionUserId,
    ...createUserHandlers({
      requireSessionUserId,
    }),
    ...createWorkspaceHandlers({
      requireSessionUserId,
      resolveOwnedRecordOrNull,
      getWorkspaceByIdForSessionUser,
    }),
    ...createNodeHandlers({
      requireSessionUserId,
      resolveOwnedRecordOrNull,
      resolveOwnedRecordOrNotFound,
      getWorkspaceByIdForSessionUser,
      getNodeByIdForSessionUser,
    }),
    ...createMessageHandlers({
      requireSessionUserId,
      resolveOwnedRecordOrNull,
      resolveOwnedRecordOrNotFound,
      getNodeByIdForSessionUser,
    }),
    ...createAnnotationHandlers({
      requireSessionUserId,
      resolveOwnedRecordOrNull,
      resolveOwnedRecordOrNotFound,
      throwNotFound,
    }),
    ...createConversationHandlers({
      requireSessionUserId,
      resolveOwnedRecordOrNotFound,
    }),
  }
}
