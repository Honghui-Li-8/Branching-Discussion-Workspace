import { TRPCError } from '@trpc/server'
import type { AppRouterContext } from '@branching/shared'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  deleteMessageForAuthor as deleteMessageForAuthorRecord,
  getBranchEventMetadataFromRecord,
  getNodeByIdForAuthor as getNodeByIdForAuthorRecord,
  listParentMessagesUpToSourceForAuthor as listParentMessagesUpToSourceForAuthorRecord,
  listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord,
  updateMessageForAuthor as updateMessageForAuthorRecord,
} from '../db/index.js'
import { messageExists as messageExistsRecord } from '../db/queries/message.js'
import { nodeExists as nodeExistsRecord } from '../db/queries/node.js'
import { createLogger } from '../logging/logger.js'
import { buildPlaceholderAssistantReply } from '../utils/placeholderModelReply.js'
import type { ContextOwnershipHelpers } from './types.js'

const logger = createLogger('trpc-context')

type MessageHandlers = Pick<
  AppRouterContext,
  | 'listMessagesForNode'
  | 'listParentMessagesUpToSource'
  | 'listInheritedMessagesForNode'
  | 'createMessage'
  | 'updateMessage'
  | 'deleteMessage'
>

const listInheritedMessageChainForAuthor = async (
  sourceNodeId: string,
  sourceMessageId: string,
  authorUserId: string,
  visited: Set<string>,
): Promise<Awaited<ReturnType<typeof listMessagesForNodeForAuthorRecord>>> => {
  const visitKey = `${sourceNodeId}:${sourceMessageId}`
  if (visited.has(visitKey)) {
    return []
  }
  visited.add(visitKey)

  const parentMessages = await listParentMessagesUpToSourceForAuthorRecord(
    sourceNodeId,
    sourceMessageId,
    authorUserId,
  )
  const upstreamBranchEvent = parentMessages.find((message) =>
    getBranchEventMetadataFromRecord(message) !== null,
  )
  const upstreamBranchEventMetadata = upstreamBranchEvent
    ? getBranchEventMetadataFromRecord(upstreamBranchEvent)
    : null

  if (!upstreamBranchEventMetadata) {
    return parentMessages
  }

  const ancestorMessages = await listInheritedMessageChainForAuthor(
    upstreamBranchEventMetadata.sourceNodeId,
    upstreamBranchEventMetadata.sourceMessageId,
    authorUserId,
    visited,
  )

  return [...ancestorMessages, ...parentMessages]
}

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
    try {
      const node = await getNodeByIdForSessionUser(nodeId)
      if (!node) {
        return []
      }

      return await listMessagesForNodeForAuthorRecord(nodeId, currentUserId)
    } catch (error) {
      logger.error('[message] list-by-node request failed.', {
        node_id: nodeId,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[message] list-by-node request debug error details.', {
        node_id: nodeId,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  listParentMessagesUpToSource: async (input) => {
    const currentUserId = requireSessionUserId()
    try {
      const sourceNode = await getNodeByIdForSessionUser(input.sourceNodeId)
      if (!sourceNode) {
        return []
      }

      return await listParentMessagesUpToSourceForAuthorRecord(
        input.sourceNodeId,
        input.sourceMessageId,
        currentUserId,
      )
    } catch (error) {
      logger.error('[message] list-parent-up-to-source request failed.', {
        source_node_id: input.sourceNodeId,
        source_message_id: input.sourceMessageId,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[message] list-parent-up-to-source request debug error details.', {
        source_node_id: input.sourceNodeId,
        source_message_id: input.sourceMessageId,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  listInheritedMessagesForNode: async (input) => {
    const currentUserId = requireSessionUserId()
    try {
      const node = await getNodeByIdForSessionUser(input.nodeId)
      if (!node) {
        return []
      }

      const localMessages = await listMessagesForNodeForAuthorRecord(
        input.nodeId,
        currentUserId,
      )
      const branchEventMessage = localMessages.find((message) =>
        getBranchEventMetadataFromRecord(message) !== null,
      )
      const branchEventMetadata = branchEventMessage
        ? getBranchEventMetadataFromRecord(branchEventMessage)
        : null

      if (!branchEventMetadata) {
        return []
      }

      return await listInheritedMessageChainForAuthor(
        branchEventMetadata.sourceNodeId,
        branchEventMetadata.sourceMessageId,
        currentUserId,
        new Set<string>(),
      )
    } catch (error) {
      logger.error('[message] list-inherited-messages-for-node request failed.', {
        node_id: input.nodeId,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[message] list-inherited-messages-for-node request debug error details.', {
        node_id: input.nodeId,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  createMessage: async (input) => {
    const currentUserId = requireSessionUserId()
    try {
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
          logger.debug('[placeholder-model] Debug error details for assistant echo persistence failure.', {
            node_id: input.nodeId,
            author_user_id: currentUserId,
            error,
          })
        }
      }

      return message
    } catch (error) {
      logger.error('[message] create request failed.', {
        node_id: input.nodeId,
        role: input.role,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[message] create request debug error details.', {
        node_id: input.nodeId,
        role: input.role,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  updateMessage: async (input) => {
    const currentUserId = requireSessionUserId()
    try {
      return await resolveOwnedRecordOrNull(
        await updateMessageForAuthorRecord(input, currentUserId),
        input.id,
        messageExistsRecord,
      )
    } catch (error) {
      logger.error('[message] update request failed.', {
        message_id: input.id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[message] update request debug error details.', {
        message_id: input.id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  deleteMessage: async (id) => {
    const currentUserId = requireSessionUserId()
    try {
      return await resolveOwnedRecordOrNull(
        await deleteMessageForAuthorRecord(id, currentUserId),
        id,
        messageExistsRecord,
      )
    } catch (error) {
      logger.error('[message] delete request failed.', {
        message_id: id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[message] delete request debug error details.', {
        message_id: id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
})
