import { TRPCError } from '@trpc/server'
import type { AppRouterContext } from '@branching/shared'
import {
  createMessageAnnotationForAuthor as createMessageAnnotationForAuthorRecord,
  deleteNodeForAuthor as deleteNodeForAuthorRecord,
  getNodeByIdForAuthor as getNodeByIdForAuthorRecord,
  getMessageAnnotationByIdForAuthor as getMessageAnnotationByIdForAuthorRecord,
  getMessageByIdForAuthor as getMessageByIdForAuthorRecord,
  listMessageAnnotationsByMessageForAuthor as listMessageAnnotationsByMessageForAuthorRecord,
  softDeleteMessageAnnotationForAuthor as softDeleteMessageAnnotationForAuthorRecord,
  transitionMessageAnnotationToSuggestionForAuthor as transitionMessageAnnotationToSuggestionForAuthorRecord,
} from '../db/index.js'
import { messageExists as messageExistsRecord } from '../db/queries/internal.js'
import { messageAnnotationExists as messageAnnotationExistsRecord } from '../db/queries/messageAnnotation.js'
import {
  branchMessageFromSelectionInTransaction,
  MessageBranchSelectionConflictError,
} from '../annotations/branchMessageFromSelection.js'
import { createLogger } from '../logging/logger.js'
import type { ContextOwnershipHelpers } from './types.js'

type AnnotationHandlers = Pick<
  AppRouterContext,
  | 'listMessageAnnotationsByMessage'
  | 'messageSuggestFromSelection'
  | 'messageAnnotationDelete'
  | 'messageBranchFromSelection'
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
  messageSuggestFromSelection: async (input) => {
    let currentUserId: string | null = null

    try {
      const resolvedUserId = requireSessionUserId()
      currentUserId = resolvedUserId
      logger.info('[annotations] suggest request received.', {
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

      const annotation = await createMessageAnnotationForAuthorRecord({
        messageId: input.messageId,
        kind: 'suggestion',
        quote: input.selection.quote,
        startOffset: input.selection.startOffset ?? null,
        endOffset: input.selection.endOffset ?? null,
        selectorJson: input.selection.selectorJson,
        authorUserId: resolvedUserId,
        idempotencyKey: input.idempotencyKey,
      })
      if (!annotation) {
        return throwNotFound('Message not found.')
      }

      logger.info('[annotations] suggest request completed.', {
        message_id: input.messageId,
        author_user_id: resolvedUserId,
        annotation_id: annotation.id,
      })
      return annotation
    } catch (error) {
      logger.error('[annotations] suggest request failed.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        idempotency_key: input.idempotencyKey,
        error,
      })
      logger.debug('[annotations] suggest request debug error details.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        idempotency_key: input.idempotencyKey,
        error,
      })
      throw error
    }
  },
  messageAnnotationDelete: async (input) => {
    let currentUserId: string | null = null

    try {
      const resolvedUserId = requireSessionUserId()
      currentUserId = resolvedUserId
      logger.info('[annotations] delete request received.', {
        annotation_id: input.annotationId,
        author_user_id: resolvedUserId,
      })

      const annotation = await resolveOwnedRecordOrNotFound(
        await getMessageAnnotationByIdForAuthorRecord(input.annotationId, resolvedUserId),
        input.annotationId,
        messageAnnotationExistsRecord,
        'Message annotation not found.',
      )

      let deletedBranchNodeId: string | null = null
      let deletedNodeCount = 0
      let deletedMessageCount = 0

      if (annotation.leadsToNodeId) {
        const linkedNode = await getNodeByIdForAuthorRecord(annotation.leadsToNodeId, resolvedUserId)
        if (linkedNode && linkedNode.parentNodeId === linkedNode.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cannot delete workspace root from annotation removal.',
          })
        }

        const nodeDeleteResult = await deleteNodeForAuthorRecord(annotation.leadsToNodeId, resolvedUserId)
        if (nodeDeleteResult) {
          deletedBranchNodeId = nodeDeleteResult.id
          deletedNodeCount = nodeDeleteResult.deletedNodeCount
          deletedMessageCount = nodeDeleteResult.deletedMessageCount
        }
      }

      if (annotation.kind === 'suggestion-branch') {
        const transitioned = await transitionMessageAnnotationToSuggestionForAuthorRecord(
          annotation.id,
          resolvedUserId,
        )
        if (!transitioned) {
          return throwNotFound('Message annotation not found.')
        }

        logger.info('[annotations] delete request completed (downgraded suggestion-branch).', {
          annotation_id: transitioned.id,
          author_user_id: resolvedUserId,
          deleted_branch_node_id: deletedBranchNodeId,
          deleted_node_count: deletedNodeCount,
          deleted_message_count: deletedMessageCount,
        })
        return {
          annotationId: transitioned.id,
          deletedBranchNodeId,
          deletedNodeCount,
          deletedMessageCount,
        }
      }

      const deleted = await softDeleteMessageAnnotationForAuthorRecord(annotation.id, resolvedUserId)
      if (!deleted) {
        return throwNotFound('Message annotation not found.')
      }

      logger.info('[annotations] delete request completed.', {
        annotation_id: deleted.id,
        author_user_id: resolvedUserId,
        deleted_branch_node_id: deletedBranchNodeId,
        deleted_node_count: deletedNodeCount,
        deleted_message_count: deletedMessageCount,
      })
      return {
        annotationId: deleted.id,
        deletedBranchNodeId,
        deletedNodeCount,
        deletedMessageCount,
      }
    } catch (error) {
      logger.error('[annotations] delete request failed.', {
        annotation_id: input.annotationId,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[annotations] delete request debug error details.', {
        annotation_id: input.annotationId,
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
