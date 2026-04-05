import type { AppRouterContext } from '@branching/shared'
import { getNodeByIdForAuthor as getNodeByIdForAuthorRecord } from '../db/index.js'
import { nodeExists as nodeExistsRecord } from '../db/queries/internal.js'
import { sendConversationTurn } from '../chat/sendConversationTurn.js'
import { createLogger } from '../logging/logger.js'
import type { ContextOwnershipHelpers } from './types.js'

const logger = createLogger('trpc-context')

type ConversationHandlers = Pick<AppRouterContext, 'conversationSend'>

export const createConversationHandlers = ({
  requireSessionUserId,
  resolveOwnedRecordOrNotFound,
}: Pick<ContextOwnershipHelpers, 'requireSessionUserId' | 'resolveOwnedRecordOrNotFound'>): ConversationHandlers => ({
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
})
