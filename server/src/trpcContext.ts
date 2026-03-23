import { TRPCError } from '@trpc/server'
import type { Request } from 'express'
import type { AppRouterContext } from '@branching/shared'
import { getSessionIdFromCookieHeader } from './auth/cookies.js'
import { getSessionUser } from './auth/sessionStore.js'
import {
  createMessage as createMessageRecord,
  createNode as createNodeRecord,
  createWorkspace as createWorkspaceRecord,
  deleteMessage as deleteMessageRecord,
  deleteNode as deleteNodeRecord,
  deleteWorkspace as deleteWorkspaceRecord,
  getMessageById,
  getNodeById as getNodeByIdRecord,
  getUserById,
  getWorkspaceById as getWorkspaceByIdRecord,
  listMessagesForNode as listMessagesForNodeRecord,
  listNodesByWorkspace as listNodesByWorkspaceRecord,
  listWorkspaces as listWorkspacesRecord,
  updateMessage as updateMessageRecord,
  updateNode as updateNodeRecord,
  updateWorkspace as updateWorkspaceRecord,
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

  const assertWorkspaceOwned = async (workspaceId: string) => {
    const currentUserId = requireSessionUserId()
    const workspace = await getWorkspaceByIdRecord(workspaceId)
    if (!workspace) {
      return null
    }
    if (workspace.authorUserId !== currentUserId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Workspace access is forbidden.',
      })
    }
    return workspace
  }

  const assertNodeOwned = async (nodeId: string) => {
    requireSessionUserId()
    const node = await getNodeByIdRecord(nodeId)
    if (!node) {
      return null
    }

    const workspace = await assertWorkspaceOwned(node.workspaceId)
    if (!workspace) {
      return null
    }

    return node
  }

  const assertMessageOwned = async (messageId: string) => {
    requireSessionUserId()
    const message = await getMessageById(messageId)
    if (!message) {
      return null
    }

    const node = await assertNodeOwned(message.nodeId)
    if (!node) {
      return null
    }

    return message
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
    listWorkspaces: async () => {
      const currentUserId = requireSessionUserId()
      const workspaces = await listWorkspacesRecord()
      return workspaces.filter((workspace) => workspace.authorUserId === currentUserId)
    },
    getWorkspaceById: async (id) => assertWorkspaceOwned(id),
    createWorkspace: async (input) => {
      const currentUserId = requireSessionUserId()
      return createWorkspaceRecord({
        ...input,
        authorUserId: currentUserId,
      })
    },
    updateWorkspace: async (input) => {
      const existingWorkspace = await assertWorkspaceOwned(input.id)
      if (!existingWorkspace) {
        return null
      }

      return updateWorkspaceRecord(input)
    },
    deleteWorkspace: async (id) => {
      const existingWorkspace = await assertWorkspaceOwned(id)
      if (!existingWorkspace) {
        return null
      }

      return deleteWorkspaceRecord(id)
    },
    listNodesByWorkspace: async (workspaceId) => {
      const workspace = await assertWorkspaceOwned(workspaceId)
      if (!workspace) {
        return []
      }

      return listNodesByWorkspaceRecord(workspaceId)
    },
    getNodeById: async (id) => assertNodeOwned(id),
    createNode: async (input) => {
      const currentUserId = requireSessionUserId()
      const workspace = await assertWorkspaceOwned(input.workspaceId)
      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found.',
        })
      }

      return createNodeRecord({
        ...input,
        authorUserId: currentUserId,
      })
    },
    updateNode: async (input) => {
      const existingNode = await assertNodeOwned(input.id)
      if (!existingNode) {
        return null
      }

      return updateNodeRecord(input)
    },
    deleteNode: async (id) => {
      const existingNode = await assertNodeOwned(id)
      if (!existingNode) {
        return null
      }

      return deleteNodeRecord(id)
    },
    listMessagesForNode: async (nodeId) => {
      const node = await assertNodeOwned(nodeId)
      if (!node) {
        return []
      }

      return listMessagesForNodeRecord(nodeId)
    },
    createMessage: async (input) => {
      const currentUserId = requireSessionUserId()
      const node = await assertNodeOwned(input.nodeId)
      if (!node) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Node not found.',
        })
      }

      return createMessageRecord({
        ...input,
        authorUserId: currentUserId,
      })
    },
    updateMessage: async (input) => {
      const existingMessage = await assertMessageOwned(input.id)
      if (!existingMessage) {
        return null
      }

      return updateMessageRecord(input)
    },
    deleteMessage: async (id) => {
      const existingMessage = await assertMessageOwned(id)
      if (!existingMessage) {
        return null
      }

      return deleteMessageRecord(id)
    },
  }
}

