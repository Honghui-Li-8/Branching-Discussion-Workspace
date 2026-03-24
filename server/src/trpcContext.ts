import { TRPCError } from '@trpc/server'
import type { Request } from 'express'
import type { AppRouterContext } from '@branching/shared'
import { getSessionIdFromCookieHeader } from './auth/cookies.js'
import { getSessionUser } from './auth/sessionStore.js'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  createNodeForAuthor as createNodeForAuthorRecord,
  createWorkspace as createWorkspaceRecord,
  deleteMessageForAuthor as deleteMessageForAuthorRecord,
  deleteNodeForAuthor as deleteNodeForAuthorRecord,
  deleteWorkspaceForAuthor as deleteWorkspaceForAuthorRecord,
  getUserById,
  getNodeByIdForAuthor as getNodeByIdForAuthorRecord,
  getWorkspaceByIdForAuthor as getWorkspaceByIdForAuthorRecord,
  listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord,
  listNodesByWorkspaceForAuthor as listNodesByWorkspaceForAuthorRecord,
  listWorkspacesByAuthor as listWorkspacesByAuthorRecord,
  messageExists as messageExistsRecord,
  nodeExists as nodeExistsRecord,
  updateMessageForAuthor as updateMessageForAuthorRecord,
  updateNodeForAuthor as updateNodeForAuthorRecord,
  updateWorkspaceForAuthor as updateWorkspaceForAuthorRecord,
  workspaceExists as workspaceExistsRecord,
} from './db/index.js'

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

  const getWorkspaceByIdForSessionUser = async (workspaceId: string) => {
    const currentUserId = requireSessionUserId()
    const workspace = await getWorkspaceByIdForAuthorRecord(workspaceId, currentUserId)
    if (workspace) {
      return workspace
    }

    if (await workspaceExistsRecord(workspaceId)) {
      throwWorkspaceForbidden()
    }

    return null
  }

  const getNodeByIdForSessionUser = async (nodeId: string) => {
    const currentUserId = requireSessionUserId()
    const node = await getNodeByIdForAuthorRecord(nodeId, currentUserId)
    if (node) {
      return node
    }

    if (await nodeExistsRecord(nodeId)) {
      throwWorkspaceForbidden()
    }

    return null
  }

  return {
    sessionUserId,
    listUsers: async () => {
      const currentUserId = requireSessionUserId()
      const currentUser = await getUserById(currentUserId)
      return currentUser ? [currentUser] : []
    },
    getUserById: async (id) => {
      const currentUserId = requireSessionUserId()
      if (id !== currentUserId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'User access is forbidden.',
        })
      }

      return getUserById(id)
    },
    createUser: async () => {
      requireSessionUserId()
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'User creation is managed by the auth flow.',
      })
    },
    listWorkspaces: async () => listWorkspacesByAuthorRecord(requireSessionUserId()),
    getWorkspaceById: async (id) => getWorkspaceByIdForSessionUser(id),
    createWorkspace: async (input) => {
      const currentUserId = requireSessionUserId()
      return createWorkspaceRecord({
        ...input,
        authorUserId: currentUserId,
      })
    },
    updateWorkspace: async (input) => {
      const currentUserId = requireSessionUserId()
      const updatedWorkspace = await updateWorkspaceForAuthorRecord(input, currentUserId)
      if (updatedWorkspace) {
        return updatedWorkspace
      }

      if (await workspaceExistsRecord(input.id)) {
        throwWorkspaceForbidden()
      }

      return null
    },
    deleteWorkspace: async (id) => {
      const currentUserId = requireSessionUserId()
      const deleteResult = await deleteWorkspaceForAuthorRecord(id, currentUserId)
      if (deleteResult) {
        return deleteResult
      }

      if (await workspaceExistsRecord(id)) {
        throwWorkspaceForbidden()
      }

      return null
    },
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
      const workspace = await getWorkspaceByIdForSessionUser(input.workspaceId)
      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found.',
        })
      }

      const node = await createNodeForAuthorRecord({
        ...input,
        authorUserId: currentUserId,
      })
      if (!node) {
        throw new Error('Parent node not found in workspace')
      }
      return node
    },
    updateNode: async (input) => {
      const currentUserId = requireSessionUserId()
      const updatedNode = await updateNodeForAuthorRecord(input, currentUserId)
      if (updatedNode) {
        return updatedNode
      }

      if (await nodeExistsRecord(input.id)) {
        throwWorkspaceForbidden()
      }

      return null
    },
    deleteNode: async (id) => {
      const currentUserId = requireSessionUserId()
      const deleteResult = await deleteNodeForAuthorRecord(id, currentUserId)
      if (deleteResult) {
        return deleteResult
      }

      if (await nodeExistsRecord(id)) {
        throwWorkspaceForbidden()
      }

      return null
    },
    listMessagesForNode: async (nodeId) => {
      const currentUserId = requireSessionUserId()
      const node = await getNodeByIdForSessionUser(nodeId)
      if (!node) {
        return []
      }

      return listMessagesForNodeForAuthorRecord(nodeId, currentUserId)
    },
    createMessage: async (input) => {
      const currentUserId = requireSessionUserId()
      const node = await getNodeByIdForSessionUser(input.nodeId)
      if (!node) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Node not found.',
        })
      }

      const message = await createMessageForAuthorRecord({
        ...input,
        authorUserId: currentUserId,
      })
      if (!message) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Node not found.',
        })
      }
      return message
    },
    updateMessage: async (input) => {
      const currentUserId = requireSessionUserId()
      const updatedMessage = await updateMessageForAuthorRecord(input, currentUserId)
      if (updatedMessage) {
        return updatedMessage
      }

      if (await messageExistsRecord(input.id)) {
        throwWorkspaceForbidden()
      }

      return null
    },
    deleteMessage: async (id) => {
      const currentUserId = requireSessionUserId()
      const deleteResult = await deleteMessageForAuthorRecord(id, currentUserId)
      if (deleteResult) {
        return deleteResult
      }

      if (await messageExistsRecord(id)) {
        throwWorkspaceForbidden()
      }

      return null
    },
  }
}
