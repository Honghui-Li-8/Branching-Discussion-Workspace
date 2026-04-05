import type { AppRouterContext } from '@branching/shared'
import { getClient } from '../db/client.js'
import type { MessageAnnotationRecord } from '../db/models/messageAnnotation.js'
import { getMessageBranchSourceContextForAuthorInTransaction } from '../db/queries/message.js'
import {
  createMessageAnnotationForAuthorInTransaction,
  getMessageAnnotationByIdempotencyKeyForAuthorInTransaction,
  linkMessageAnnotationToNodeForAuthorInTransaction,
} from '../db/queries/messageAnnotation.js'
import { createNodeForAuthorInTransaction } from '../db/queries/node.js'

type MessageBranchFromSelectionInput = Parameters<AppRouterContext['messageBranchFromSelection']>[0]
type MessageBranchFromSelectionResult = Awaited<
  ReturnType<AppRouterContext['messageBranchFromSelection']>
>

const DEFAULT_BRANCH_TYPE: NonNullable<
  MessageBranchFromSelectionInput['newNodeMeta']
>['type'] = 'option'

const DEFAULT_BRANCH_SUMMARY = 'Branch generated from assistant message selection.'
const MAX_BRANCH_TITLE_LENGTH = 96

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
  const client = await getClient()

  try {
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

    const branchMeta = resolveBranchNodeMeta(input)
    const branchNode = await createNodeForAuthorInTransaction(client, {
      workspaceId: source.workspaceId,
      authorUserId: currentUserId,
      parentNodeId: source.parentNodeId,
      type: branchMeta.type,
      title: branchMeta.title,
      summary: branchMeta.summary,
    })
    if (!branchNode) {
      throw new Error('Failed to create branch node.')
    }

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

    return {
      annotation: mapAnnotationToResult(linkedAnnotation),
      branchNodeId: branchNode.id,
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Ignore rollback failures and rethrow original error.
    }

    throw error
  } finally {
    client.release()
  }
}
