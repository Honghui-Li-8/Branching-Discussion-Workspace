import type { AppRouterContext } from '@branching/shared'
import type { PoolClient } from 'pg'
import { getClient } from '../db/client.js'
import type { MessageAnnotationRecord } from '../db/models/messageAnnotation.js'
import { getMessageBranchSourceContextForAuthorInTransaction } from '../db/queries/message.js'
import {
  createMessageAnnotationForAuthorInTransaction,
  getMessageAnnotationByIdempotencyKeyForAuthorInTransaction,
  linkMessageAnnotationToNodeForAuthorInTransaction,
} from '../db/queries/messageAnnotation.js'
import { createNodeForAuthorInTransaction } from '../db/queries/node.js'
import { createLogger } from '../logging/logger.js'

type MessageBranchFromSelectionInput = Parameters<AppRouterContext['messageBranchFromSelection']>[0]
type MessageBranchFromSelectionResult = Awaited<
  ReturnType<AppRouterContext['messageBranchFromSelection']>
>

const DEFAULT_BRANCH_TYPE: NonNullable<
  MessageBranchFromSelectionInput['newNodeMeta']
>['type'] = 'option'

const DEFAULT_BRANCH_SUMMARY = 'Branch generated from assistant message selection.'
const MAX_BRANCH_TITLE_LENGTH = 96
const logger = createLogger('annotations')

export class MessageBranchSelectionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MessageBranchSelectionConflictError'
  }
}

const compactWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const buildDefaultBranchTitle = (quote: string): string => {
  const normalizedQuote = compactWhitespace(quote)
  const core = normalizedQuote.length > 0 ? normalizedQuote : 'Selected passage'
  const prefix = 'Branch: '
  const allowedCoreLength = Math.max(8, MAX_BRANCH_TITLE_LENGTH - prefix.length)

  if (core.length <= allowedCoreLength) {
    return `${prefix}${core}`
  }

  return `${prefix}${core.slice(0, allowedCoreLength - 3).trimEnd()}...`
}

const resolveBranchNodeMeta = (
  input: MessageBranchFromSelectionInput,
): {
  type: NonNullable<NonNullable<MessageBranchFromSelectionInput['newNodeMeta']>['type']>
  title: string
  summary: string
} => {
  const requestedTitle = input.newNodeMeta?.title ? compactWhitespace(input.newNodeMeta.title) : ''
  const requestedSummary = input.newNodeMeta?.summary
    ? compactWhitespace(input.newNodeMeta.summary)
    : ''

  const title =
    requestedTitle.length > 0 ? requestedTitle : buildDefaultBranchTitle(input.selection.quote)
  const summary = requestedSummary.length > 0 ? requestedSummary : DEFAULT_BRANCH_SUMMARY
  const type = input.newNodeMeta?.type ?? DEFAULT_BRANCH_TYPE

  return {
    type,
    title,
    summary,
  }
}

const mapAnnotationToResult = (
  annotation: MessageAnnotationRecord,
): MessageBranchFromSelectionResult['annotation'] => ({
  id: annotation.id,
  messageId: annotation.messageId,
  leadsToNodeId: annotation.leadsToNodeId,
  kind: annotation.kind,
  quote: annotation.quote,
  startOffset: annotation.startOffset,
  endOffset: annotation.endOffset,
  selectorJson: annotation.selectorJson,
  createdByUserId: annotation.createdByUserId,
  createdAt: annotation.createdAt,
  updatedAt: annotation.updatedAt,
  deletedAt: annotation.deletedAt,
})

type BranchMessageFromSelectionParams = {
  input: MessageBranchFromSelectionInput
  currentUserId: string
}

export const branchMessageFromSelectionInTransaction = async ({
  input,
  currentUserId,
}: BranchMessageFromSelectionParams): Promise<MessageBranchFromSelectionResult | null> => {
  logger.debug('[annotations] branch-from-selection started.', {
    message_id: input.messageId,
    author_user_id: currentUserId,
    idempotency_key: input.idempotencyKey,
    selection_quote_length: input.selection.quote.length,
    selector_count: input.selection.selectorJson.selector.length,
  })

  let client: PoolClient | null = null

  try {
    client = await getClient()
    await client.query('BEGIN')

    const source = await getMessageBranchSourceContextForAuthorInTransaction(
      client,
      input.messageId,
      currentUserId,
    )
    if (!source) {
      await client.query('ROLLBACK')
      return null
    }

    const existing = await getMessageAnnotationByIdempotencyKeyForAuthorInTransaction(client, {
      messageId: input.messageId,
      authorUserId: currentUserId,
      idempotencyKey: input.idempotencyKey,
    })
    if (existing) {
      logger.debug('[annotations] branch-from-selection idempotency hit.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        idempotency_key: input.idempotencyKey,
        annotation_id: existing.id,
        leads_to_node_id: existing.leadsToNodeId,
      })
      if (!existing.leadsToNodeId) {
        throw new MessageBranchSelectionConflictError(
          'Existing idempotency record is incomplete and has no branch node link.',
        )
      }

      await client.query('COMMIT')
      return {
        annotation: mapAnnotationToResult(existing),
        branchNodeId: existing.leadsToNodeId,
      }
    }

    logger.debug('[annotations] creating annotation record.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      kind: 'branch',
      idempotency_key: input.idempotencyKey,
      quote_length: input.selection.quote.length,
      selector_count: input.selection.selectorJson.selector.length,
    })
    const insertedAnnotation = await createMessageAnnotationForAuthorInTransaction(client, {
      messageId: input.messageId,
      kind: 'branch',
      quote: input.selection.quote,
      startOffset: input.selection.startOffset ?? null,
      endOffset: input.selection.endOffset ?? null,
      selectorJson: input.selection.selectorJson,
      authorUserId: currentUserId,
      idempotencyKey: input.idempotencyKey,
    })
    if (!insertedAnnotation) {
      logger.debug('[annotations] annotation insert returned null, trying idempotency recovery.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        idempotency_key: input.idempotencyKey,
      })
      const recovered = await getMessageAnnotationByIdempotencyKeyForAuthorInTransaction(client, {
        messageId: input.messageId,
        authorUserId: currentUserId,
        idempotencyKey: input.idempotencyKey,
      })
      if (!recovered || !recovered.leadsToNodeId) {
        throw new MessageBranchSelectionConflictError(
          'Idempotency record exists without a branch node link.',
        )
      }

      await client.query('COMMIT')
      return {
        annotation: mapAnnotationToResult(recovered),
        branchNodeId: recovered.leadsToNodeId,
      }
    }
    logger.debug('[annotations] annotation record created.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      annotation_id: insertedAnnotation.id,
    })

    const branchMeta = resolveBranchNodeMeta(input)
    logger.debug('[annotations] creating branch node.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      workspace_id: source.workspaceId,
      parent_node_id: source.parentNodeId,
      node_type: branchMeta.type,
      node_title: branchMeta.title,
    })
    const branchNode = await createNodeForAuthorInTransaction(client, {
      workspaceId: source.workspaceId,
      authorUserId: currentUserId,
      parentNodeId: source.parentNodeId,
      type: branchMeta.type,
      title: branchMeta.title,
      summary: branchMeta.summary,
    })
    if (!branchNode) {
      logger.debug('[annotations] branch node creation returned null.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        workspace_id: source.workspaceId,
        parent_node_id: source.parentNodeId,
      })
      throw new Error('Failed to create branch node.')
    }
    logger.debug('[annotations] branch node created.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      branch_node_id: branchNode.id,
      parent_node_id: source.parentNodeId,
    })

    const linkedAnnotation = await linkMessageAnnotationToNodeForAuthorInTransaction(
      client,
      {
        id: insertedAnnotation.id,
        leadsToNodeId: branchNode.id,
      },
      currentUserId,
    )
    if (!linkedAnnotation) {
      throw new Error('Failed to link branch annotation to new node.')
    }

    await client.query('COMMIT')
    logger.debug('[annotations] branch-from-selection committed.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      annotation_id: linkedAnnotation.id,
      branch_node_id: branchNode.id,
    })

    return {
      annotation: mapAnnotationToResult(linkedAnnotation),
      branchNodeId: branchNode.id,
    }
  } catch (error) {
    logger.error('[annotations] branch-from-selection failed, rolling back.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      idempotency_key: input.idempotencyKey,
      error,
    })
    logger.debug('[annotations] branch-from-selection debug error details.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      idempotency_key: input.idempotencyKey,
      error,
    })
    if (client) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        logger.error('[annotations] branch-from-selection rollback failed.', {
          message_id: input.messageId,
          author_user_id: currentUserId,
          idempotency_key: input.idempotencyKey,
          error: rollbackError,
        })
        logger.debug('[annotations] branch-from-selection rollback debug error details.', {
          message_id: input.messageId,
          author_user_id: currentUserId,
          idempotency_key: input.idempotencyKey,
          error: rollbackError,
        })
        // Ignore rollback failures and rethrow original error.
      }
    }

    throw error
  } finally {
    client?.release()
  }
}
