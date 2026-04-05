import { TRPCError } from '@trpc/server'
import type { Request } from 'express'
import type { AppRouterContext } from '@branching/shared'
import { getSessionIdFromCookieHeader } from './auth/cookies.js'
import { getSessionUser } from './auth/sessionStore.js'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  createNodeForAuthor as createNodeForAuthorRecord,
  createWorkspaceForAuthor as createWorkspaceForAuthorRecord,
  deleteMessageForAuthor as deleteMessageForAuthorRecord,
  deleteNodeForAuthor as deleteNodeForAuthorRecord,
  deleteWorkspaceForAuthor as deleteWorkspaceForAuthorRecord,
  getMessageByIdForAuthor as getMessageByIdForAuthorRecord,
  getUserById,
  getNodeByIdForAuthor as getNodeByIdForAuthorRecord,
  getWorkspaceByIdForAuthor as getWorkspaceByIdForAuthorRecord,
  listMessageAnnotationsByMessageForAuthor as listMessageAnnotationsByMessageForAuthorRecord,
  listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord,
  listNodesByWorkspaceForAuthor as listNodesByWorkspaceForAuthorRecord,
  listWorkspacesByAuthor as listWorkspacesByAuthorRecord,
  updateMessageForAuthor as updateMessageForAuthorRecord,
  updateNodeForAuthor as updateNodeForAuthorRecord,
  updateWorkspaceForAuthor as updateWorkspaceForAuthorRecord,
} from './db/index.js'
import {
  messageExists as messageExistsRecord,
  nodeExists as nodeExistsRecord,
  workspaceExists as workspaceExistsRecord,
} from './db/queries/internal.js'
import { buildPlaceholderAssistantReply } from './utils/placeholderModelReply.js'
import { sendConversationTurn } from './chat/sendConversationTurn.js'
import { createLogger } from './logging/logger.js'
import {
  branchMessageFromSelectionInTransaction,
  MessageBranchSelectionConflictError,
} from './annotations/branchMessageFromSelection.js'

type ContextRequest = Pick<Request, 'headers'>
type ExistsById = (id: string) => Promise<boolean>
const logger = createLogger('trpc-context')

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
      await resolveOwnedRecordOrNotFound(
        await getNodeByIdForAuthorRecord(input.nodeId, currentUserId),
        input.nodeId,
        nodeExistsRecord,
        'Node not found.',
      )

      const message = await createMessageForAuthorRecord({
        ...input,
        authorUserId: currentUserId,
      })
      if (message === null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Node not found.',
        })
      }

      if (input.role === 'user') {
        try {
          const response = buildPlaceholderAssistantReply(input.content);
          await createMessageForAuthorRecord({
            nodeId: input.nodeId,
            authorUserId: currentUserId,
            role: "assistant",
            content: response,
          });
        } catch (error) {
          logger.warn('[placeholder-model] Failed to persist assistant echo reply.', {
            node_id: input.nodeId,
            author_user_id: currentUserId,
            error,
          })
        }
      }

      return message
    },
    updateMessage: async (input) => {
      const currentUserId = requireSessionUserId()
      return resolveOwnedRecordOrNull(
        await updateMessageForAuthorRecord(input, currentUserId),
        input.id,
        messageExistsRecord,
      )
    },
    deleteMessage: async (id) => {
      const currentUserId = requireSessionUserId()
      return resolveOwnedRecordOrNull(
        await deleteMessageForAuthorRecord(id, currentUserId),
        id,
        messageExistsRecord,
      )
    },
    listMessageAnnotationsByMessage: async (messageId) => {
      const currentUserId = requireSessionUserId()
      const message = await resolveOwnedRecordOrNull(
        await getMessageByIdForAuthorRecord(messageId, currentUserId),
        messageId,
        messageExistsRecord,
      )

      if (!message) {
        return []
      }

      return listMessageAnnotationsByMessageForAuthorRecord(messageId, currentUserId)
    },
    messageBranchFromSelection: async (input) => {
      const currentUserId = requireSessionUserId()
      await resolveOwnedRecordOrNotFound(
        await getMessageByIdForAuthorRecord(input.messageId, currentUserId),
        input.messageId,
        messageExistsRecord,
        'Message not found.',
      )

      try {
        const result = await branchMessageFromSelectionInTransaction({
          input,
          currentUserId,
        })

        if (!result) {
          return throwNotFound('Message not found.')
        }

        return result
      } catch (error) {
        if (error instanceof MessageBranchSelectionConflictError) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          })
        }

        throw error
      }
    },
    conversationSend: async (input) => {
      const currentUserId = requireSessionUserId()
      await resolveOwnedRecordOrNotFound(
        await getNodeByIdForAuthorRecord(input.nodeId, currentUserId),
        input.nodeId,
        nodeExistsRecord,
        'Node not found.',
      )

      logger.info('[chat] conversationSend request accepted.', {
        node_id: input.nodeId,
        author_user_id: currentUserId,
        model: input.model,
        idempotency_key: input.idempotencyKey,
        text_length: input.text.length,
      })

      try {
        const result = await sendConversationTurn({
          input,
          currentUserId,
        })
        logger.info('[chat] conversationSend request completed.', {
          node_id: input.nodeId,
          author_user_id: currentUserId,
          model: input.model,
          turn_id: result.turnId,
          status: result.status,
        })
        return result
      } catch (error) {
        logger.error('[chat] conversationSend request failed.', {
          node_id: input.nodeId,
          author_user_id: currentUserId,
          model: input.model,
          idempotency_key: input.idempotencyKey,
          error,
        })
        throw error
      }
    },
  }
}
