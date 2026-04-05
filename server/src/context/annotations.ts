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
import type { ContextOwnershipHelpers } from './types.js'

type AnnotationHandlers = Pick<
  AppRouterContext,
  'listMessageAnnotationsByMessage' | 'messageBranchFromSelection'
>

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
})
