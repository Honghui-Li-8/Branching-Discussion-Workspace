import { TRPCError } from '@trpc/server'
import type { AppRouterContext } from '@branching/shared'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  deleteMessageForAuthor as deleteMessageForAuthorRecord,
  getNodeByIdForAuthor as getNodeByIdForAuthorRecord,
  listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord,
  updateMessageForAuthor as updateMessageForAuthorRecord,
} from '../db/index.js'
import {
  messageExists as messageExistsRecord,
  nodeExists as nodeExistsRecord,
} from '../db/queries/internal.js'
import { createLogger } from '../logging/logger.js'
import { buildPlaceholderAssistantReply } from '../utils/placeholderModelReply.js'
import type { ContextOwnershipHelpers } from './types.js'

const logger = createLogger('trpc-context')

type MessageHandlers = Pick<
  AppRouterContext,
  'listMessagesForNode' | 'createMessage' | 'updateMessage' | 'deleteMessage'
>

export const createMessageHandlers = ({
  requireSessionUserId,
  resolveOwnedRecordOrNull,
  resolveOwnedRecordOrNotFound,
  getNodeByIdForSessionUser,
}: Pick<
  ContextOwnershipHelpers,
  'requireSessionUserId' | 'resolveOwnedRecordOrNull' | 'resolveOwnedRecordOrNotFound' | 'getNodeByIdForSessionUser'
>): MessageHandlers => ({
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
        const response = buildPlaceholderAssistantReply(input.content)
        await createMessageForAuthorRecord({
          nodeId: input.nodeId,
          authorUserId: currentUserId,
          role: 'assistant',
          content: response,
        })
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
})
