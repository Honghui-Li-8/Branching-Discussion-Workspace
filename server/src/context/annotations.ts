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
    let currentUserId: string | null = null

    try {
      const resolvedUserId = requireSessionUserId()
      currentUserId = resolvedUserId
      logger.info('[annotations] list request received.', {
        message_id: messageId,
        author_user_id: resolvedUserId,
      })

      const message = await resolveOwnedRecordOrNull(
        await getMessageByIdForAuthorRecord(messageId, resolvedUserId),
        messageId,
        messageExistsRecord,
      )

      if (!message) {
        logger.info('[annotations] list request resolved: message not accessible or missing.', {
          message_id: messageId,
          author_user_id: resolvedUserId,
        })
        return []
      }

      const annotations = await listMessageAnnotationsByMessageForAuthorRecord(
        messageId,
        resolvedUserId,
      )
      logger.info('[annotations] list request completed.', {
        message_id: messageId,
        author_user_id: resolvedUserId,
        annotation_count: annotations.length,
      })
      return annotations
    } catch (error) {
      logger.error('[annotations] list request failed.', {
        message_id: messageId,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[annotations] list request debug error details.', {
        message_id: messageId,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  messageBranchFromSelection: async (input) => {
    let currentUserId: string | null = null

    try {
      const resolvedUserId = requireSessionUserId()
      currentUserId = resolvedUserId
      logger.info('[annotations] branch request received.', {
        message_id: input.messageId,
        author_user_id: resolvedUserId,
        idempotency_key: input.idempotencyKey,
        selection_quote_length: input.selection.quote.length,
        selector_count: input.selection.selectorJson.selector.length,
      })

      await resolveOwnedRecordOrNotFound(
        await getMessageByIdForAuthorRecord(input.messageId, resolvedUserId),
        input.messageId,
        messageExistsRecord,
        'Message not found.',
      )

      const result = await branchMessageFromSelectionInTransaction({
        input,
        currentUserId: resolvedUserId,
      })

      if (!result) {
        return throwNotFound('Message not found.')
      }

      logger.info('[annotations] branch request completed.', {
        message_id: input.messageId,
        author_user_id: resolvedUserId,
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
        logger.debug('[annotations] branch request conflict debug error details.', {
          message_id: input.messageId,
          author_user_id: currentUserId,
          idempotency_key: input.idempotencyKey,
          error,
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
      logger.debug('[annotations] branch request debug error details.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        idempotency_key: input.idempotencyKey,
        error,
      })
      throw error
    }
  },
})
