import { TRPCError } from '@trpc/server'
import type { AppRouterContext } from '@branching/shared'
import {
  getMessageByIdForAuthor as getMessageByIdForAuthorRecord,
  listMessageAnnotationsByMessageForAuthor as listMessageAnnotationsByMessageForAuthorRecord,
} from '../db/index.js'
import { messageExists as messageExistsRecord } from '../db/queries/internal.js'
import {
  branchMessageFromSelectionInTransaction,
  MessageBranchSelectionConflictError,
} from '../annotations/branchMessageFromSelection.js'
import { createLogger } from '../logging/logger.js'
import type { ContextOwnershipHelpers } from './types.js'

type AnnotationHandlers = Pick<
  AppRouterContext,
  'listMessageAnnotationsByMessage' | 'messageBranchFromSelection'
>

const logger = createLogger('trpc-context')

export const createAnnotationHandlers = ({
  requireSessionUserId,
  resolveOwnedRecordOrNull,
  resolveOwnedRecordOrNotFound,
  throwNotFound,
}: Pick<
  ContextOwnershipHelpers,
  'requireSessionUserId' | 'resolveOwnedRecordOrNull' | 'resolveOwnedRecordOrNotFound' | 'throwNotFound'
>): AnnotationHandlers => ({
  listMessageAnnotationsByMessage: async (messageId) => {
    const currentUserId = requireSessionUserId()
    logger.info('[annotations] list request received.', {
      message_id: messageId,
      author_user_id: currentUserId,
    })

    try {
      const message = await resolveOwnedRecordOrNull(
        await getMessageByIdForAuthorRecord(messageId, currentUserId),
        messageId,
        messageExistsRecord,
      )

      if (!message) {
        logger.info('[annotations] list request resolved: message not accessible or missing.', {
          message_id: messageId,
          author_user_id: currentUserId,
        })
        return []
      }

      const annotations = await listMessageAnnotationsByMessageForAuthorRecord(
        messageId,
        currentUserId,
      )
      logger.info('[annotations] list request completed.', {
        message_id: messageId,
        author_user_id: currentUserId,
        annotation_count: annotations.length,
      })
      return annotations
    } catch (error) {
      logger.error('[annotations] list request failed.', {
        message_id: messageId,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  messageBranchFromSelection: async (input) => {
    const currentUserId = requireSessionUserId()
    logger.info('[annotations] branch request received.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      idempotency_key: input.idempotencyKey,
      selection_quote_length: input.selection.quote.length,
      selector_count: input.selection.selectorJson.selector.length,
    })

    try {
      await resolveOwnedRecordOrNotFound(
        await getMessageByIdForAuthorRecord(input.messageId, currentUserId),
        input.messageId,
        messageExistsRecord,
        'Message not found.',
      )

      const result = await branchMessageFromSelectionInTransaction({
        input,
        currentUserId,
      })

      if (!result) {
        return throwNotFound('Message not found.')
      }

      logger.info('[annotations] branch request completed.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        annotation_id: result.annotation.id,
        branch_node_id: result.branchNodeId,
      })
      return result
    } catch (error) {
      if (error instanceof MessageBranchSelectionConflictError) {
        logger.warn('[annotations] branch request conflict.', {
          message_id: input.messageId,
          author_user_id: currentUserId,
          idempotency_key: input.idempotencyKey,
          error_message: error.message,
        })
        throw new TRPCError({
          code: 'CONFLICT',
          message: error.message,
        })
      }

      logger.error('[annotations] branch request failed.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        idempotency_key: input.idempotencyKey,
        error,
      })
      throw error
    }
  },
})
