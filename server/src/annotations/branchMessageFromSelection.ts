import type { AppRouterContext } from '@branching/shared'
import { getClient } from '../db/client.js'
import { createNodeForAuthorInTransaction } from '../db/queries/node.js'

type MessageBranchFromSelectionInput = Parameters<AppRouterContext['messageBranchFromSelection']>[0]
type MessageBranchFromSelectionResult = Awaited<
  ReturnType<AppRouterContext['messageBranchFromSelection']>
>

type SourceMessageRow = {
  message_id: string
  parent_node_id: string
  workspace_id: string
}

type AnnotationRow = {
  id: string
  message_id: string
  leads_to_node_id: string | null
  kind: MessageBranchFromSelectionResult['annotation']['kind']
  quote: string
  start_offset: number | null
  end_offset: number | null
  selector_json: MessageBranchFromSelectionResult['annotation']['selectorJson']
  created_by_user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const annotationColumns = `
  id,
  message_id,
  leads_to_node_id,
  kind,
  quote,
  start_offset,
  end_offset,
  selector_json,
  created_by_user_id,
  created_at,
  updated_at,
  deleted_at
`

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

const mapAnnotationRowToResult = (
  annotationRow: AnnotationRow,
): MessageBranchFromSelectionResult['annotation'] => ({
  id: annotationRow.id,
  messageId: annotationRow.message_id,
  leadsToNodeId: annotationRow.leads_to_node_id,
  kind: annotationRow.kind,
  quote: annotationRow.quote,
  startOffset: annotationRow.start_offset,
  endOffset: annotationRow.end_offset,
  selectorJson: annotationRow.selector_json,
  createdByUserId: annotationRow.created_by_user_id,
  createdAt: annotationRow.created_at,
  updatedAt: annotationRow.updated_at,
  deletedAt: annotationRow.deleted_at,
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

    const sourceResult = await client.query<SourceMessageRow>(
      `
      SELECT
        m.id AS message_id,
        m.node_id AS parent_node_id,
        n.workspace_id AS workspace_id
      FROM messages m
      JOIN nodes n ON n.id = m.node_id
      JOIN workspaces w ON w.id = n.workspace_id
      WHERE m.id = $1
        AND w.author_user_id = $2
      LIMIT 1
      `,
      [input.messageId, currentUserId],
    )

    const source = sourceResult.rows[0]
    if (!source) {
      await client.query('ROLLBACK')
      return null
    }

    const existingResult = await client.query<AnnotationRow>(
      `
      SELECT
        ${annotationColumns}
      FROM message_annotations
      WHERE message_id = $1
        AND created_by_user_id = $2
        AND idempotency_key = $3
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [input.messageId, currentUserId, input.idempotencyKey],
    )

    const existing = existingResult.rows[0]
    if (existing) {
      if (!existing.leads_to_node_id) {
        throw new MessageBranchSelectionConflictError(
          'Existing idempotency record is incomplete and has no branch node link.',
        )
      }

      await client.query('COMMIT')
      return {
        annotation: mapAnnotationRowToResult(existing),
        branchNodeId: existing.leads_to_node_id,
      }
    }

    const insertedAnnotationResult = await client.query<AnnotationRow>(
      `
      INSERT INTO message_annotations (
        message_id,
        leads_to_node_id,
        kind,
        quote,
        start_offset,
        end_offset,
        selector_json,
        created_by_user_id,
        idempotency_key
      )
      VALUES ($1, NULL, 'branch', $2, $3, $4, $5::jsonb, $6, $7)
      ON CONFLICT (created_by_user_id, message_id, idempotency_key)
        WHERE deleted_at IS NULL
        DO NOTHING
      RETURNING
        ${annotationColumns}
      `,
      [
        input.messageId,
        input.selection.quote,
        input.selection.startOffset ?? null,
        input.selection.endOffset ?? null,
        JSON.stringify(input.selection.selectorJson),
        currentUserId,
        input.idempotencyKey,
      ],
    )

    const insertedAnnotation = insertedAnnotationResult.rows[0]
    if (!insertedAnnotation) {
      const recoveredResult = await client.query<AnnotationRow>(
        `
        SELECT
          ${annotationColumns}
        FROM message_annotations
        WHERE message_id = $1
          AND created_by_user_id = $2
          AND idempotency_key = $3
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [input.messageId, currentUserId, input.idempotencyKey],
      )

      const recovered = recoveredResult.rows[0]
      if (!recovered || !recovered.leads_to_node_id) {
        throw new MessageBranchSelectionConflictError(
          'Idempotency record exists without a branch node link.',
        )
      }

      await client.query('COMMIT')
      return {
        annotation: mapAnnotationRowToResult(recovered),
        branchNodeId: recovered.leads_to_node_id,
      }
    }

    const branchMeta = resolveBranchNodeMeta(input)
    const branchNode = await createNodeForAuthorInTransaction(client, {
      workspaceId: source.workspace_id,
      authorUserId: currentUserId,
      parentNodeId: source.parent_node_id,
      type: branchMeta.type,
      title: branchMeta.title,
      summary: branchMeta.summary,
    })
    if (!branchNode) {
      throw new Error('Failed to create branch node.')
    }

    const linkedAnnotationResult = await client.query<AnnotationRow>(
      `
      UPDATE message_annotations
      SET leads_to_node_id = $2
      WHERE id = $1
      RETURNING
        ${annotationColumns}
      `,
      [insertedAnnotation.id, branchNode.id],
    )

    const linkedAnnotation = linkedAnnotationResult.rows[0]
    if (!linkedAnnotation) {
      throw new Error('Failed to link branch annotation to new node.')
    }

    await client.query('COMMIT')

    return {
      annotation: mapAnnotationRowToResult(linkedAnnotation),
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
