import type {
  CreateMessageAnnotationForAuthorInput,
  CreateMessageAnnotationInput,
  MessageAnnotationIdempotencyLookupInput,
  MessageAnnotationKind,
  MessageAnnotationRecord,
  MessageAnnotationSelectorJson,
  UpdateMessageAnnotationLinkInput,
} from '../models/messageAnnotation.js'
import { query } from '../client.js'

type MessageAnnotationRow = {
  id: string
  message_id: string
  leads_to_node_id: string | null
  kind: MessageAnnotationKind
  quote: string
  start_offset: number | null
  end_offset: number | null
  selector_json: MessageAnnotationSelectorJson
  created_by_user_id: string
  idempotency_key: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const MESSAGE_ANNOTATION_COLUMN_NAMES = [
  'id',
  'message_id',
  'leads_to_node_id',
  'kind',
  'quote',
  'start_offset',
  'end_offset',
  'selector_json',
  'created_by_user_id',
  'idempotency_key',
  'created_at',
  'updated_at',
  'deleted_at',
] as const

const buildSelectColumns = (alias?: string): string =>
  MESSAGE_ANNOTATION_COLUMN_NAMES.map((columnName) =>
    alias ? `${alias}.${columnName}` : columnName,
  ).join(',\n      ')

const fullMessageAnnotationColumns = buildSelectColumns()
const scopedMessageAnnotationColumns = buildSelectColumns('a')

const mapMessageAnnotationRow = (row: MessageAnnotationRow): MessageAnnotationRecord => ({
  id: row.id,
  messageId: row.message_id,
  leadsToNodeId: row.leads_to_node_id,
  kind: row.kind,
  quote: row.quote,
  startOffset: row.start_offset,
  endOffset: row.end_offset,
  selectorJson: row.selector_json,
  createdByUserId: row.created_by_user_id,
  idempotencyKey: row.idempotency_key,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
})

export const listMessageAnnotationsByMessage = async (
  messageId: string,
): Promise<MessageAnnotationRecord[]> => {
  const result = await query<MessageAnnotationRow>(
    `
    SELECT
      ${scopedMessageAnnotationColumns}
    FROM message_annotations a
    WHERE a.message_id = $1
      AND a.deleted_at IS NULL
    ORDER BY a.created_at ASC
    `,
    [messageId],
  )

  return result.rows.map(mapMessageAnnotationRow)
}

export const listMessageAnnotationsByMessageForAuthor = async (
  messageId: string,
  authorUserId: string,
): Promise<MessageAnnotationRecord[]> => {
  const result = await query<MessageAnnotationRow>(
    `
    SELECT
      ${scopedMessageAnnotationColumns}
    FROM message_annotations a
    JOIN messages m ON m.id = a.message_id
    JOIN nodes n ON n.id = m.node_id
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE a.message_id = $1
      AND w.author_user_id = $2
      AND a.deleted_at IS NULL
    ORDER BY a.created_at ASC
    `,
    [messageId, authorUserId],
  )

  return result.rows.map(mapMessageAnnotationRow)
}

export const getMessageAnnotationById = async (
  id: string,
): Promise<MessageAnnotationRecord | null> => {
  const result = await query<MessageAnnotationRow>(
    `
    SELECT
      ${scopedMessageAnnotationColumns}
    FROM message_annotations a
    WHERE a.id = $1
      AND a.deleted_at IS NULL
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageAnnotationRow(result.rows[0])
}

export const getMessageAnnotationByIdForAuthor = async (
  id: string,
  authorUserId: string,
): Promise<MessageAnnotationRecord | null> => {
  const result = await query<MessageAnnotationRow>(
    `
    SELECT
      ${scopedMessageAnnotationColumns}
    FROM message_annotations a
    JOIN messages m ON m.id = a.message_id
    JOIN nodes n ON n.id = m.node_id
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE a.id = $1
      AND w.author_user_id = $2
      AND a.deleted_at IS NULL
    `,
    [id, authorUserId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageAnnotationRow(result.rows[0])
}

export const getMessageAnnotationByIdempotencyKeyForAuthor = async (
  input: MessageAnnotationIdempotencyLookupInput,
): Promise<MessageAnnotationRecord | null> => {
  const result = await query<MessageAnnotationRow>(
    `
    SELECT
      ${scopedMessageAnnotationColumns}
    FROM message_annotations a
    JOIN messages m ON m.id = a.message_id
    JOIN nodes n ON n.id = m.node_id
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE a.message_id = $1
      AND a.created_by_user_id = $2
      AND a.idempotency_key = $3
      AND w.author_user_id = $2
      AND a.deleted_at IS NULL
    LIMIT 1
    `,
    [input.messageId, input.authorUserId, input.idempotencyKey],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageAnnotationRow(result.rows[0])
}

export const messageAnnotationExists = async (id: string): Promise<boolean> => {
  const result = await query<{ id: string }>(
    `
    SELECT id
    FROM message_annotations
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  )

  return result.rows.length > 0
}

type QueryableCreateMessageAnnotationInput =
  | CreateMessageAnnotationInput
  | CreateMessageAnnotationForAuthorInput

const resolveCreateActorUserId = (input: QueryableCreateMessageAnnotationInput): string =>
  'createdByUserId' in input ? input.createdByUserId : input.authorUserId

const createMessageAnnotationParams = (
  input: QueryableCreateMessageAnnotationInput,
): [
  string,
  string | null,
  MessageAnnotationKind,
  string,
  number | null,
  number | null,
  string,
  string,
  string,
] => [
  input.messageId,
  input.leadsToNodeId ?? null,
  input.kind,
  input.quote,
  input.startOffset ?? null,
  input.endOffset ?? null,
  JSON.stringify(input.selectorJson),
  resolveCreateActorUserId(input),
  input.idempotencyKey,
]

const buildCreateMessageAnnotationSql = (options: { scopedToWorkspaceOwner: boolean }): string => {
  const ownershipGuard = options.scopedToWorkspaceOwner
    ? 'w.author_user_id = c.actor_user_id AND'
    : ''

  return `
  WITH candidate AS (
    SELECT
      $1::uuid AS message_id,
      $2::uuid AS leads_to_node_id,
      $3::text AS kind,
      $4::text AS quote,
      $5::integer AS start_offset,
      $6::integer AS end_offset,
      $7::jsonb AS selector_json,
      $8::uuid AS actor_user_id,
      $9::text AS idempotency_key
  ),
  inserted AS (
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
    SELECT
      c.message_id,
      c.leads_to_node_id,
      c.kind,
      c.quote,
      c.start_offset,
      c.end_offset,
      c.selector_json,
      c.actor_user_id,
      c.idempotency_key
    FROM candidate c
    JOIN messages m ON m.id = c.message_id
    JOIN nodes source_node ON source_node.id = m.node_id
    JOIN workspaces w ON w.id = source_node.workspace_id
    LEFT JOIN nodes target_node ON target_node.id = c.leads_to_node_id
    WHERE ${ownershipGuard}
      (c.leads_to_node_id IS NULL OR target_node.workspace_id = source_node.workspace_id)
    ON CONFLICT (created_by_user_id, message_id, idempotency_key)
      WHERE deleted_at IS NULL
      DO NOTHING
    RETURNING
      ${fullMessageAnnotationColumns}
  )
  SELECT
    ${fullMessageAnnotationColumns}
  FROM inserted

  UNION ALL

  SELECT
    ${buildSelectColumns('existing')}
  FROM message_annotations existing
  JOIN candidate c
    ON existing.message_id = c.message_id
   AND existing.created_by_user_id = c.actor_user_id
   AND existing.idempotency_key = c.idempotency_key
  WHERE existing.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM inserted)
  LIMIT 1
`
}

const createMessageAnnotationSql = buildCreateMessageAnnotationSql({
  scopedToWorkspaceOwner: false,
})

const createMessageAnnotationForAuthorSql = buildCreateMessageAnnotationSql({
  scopedToWorkspaceOwner: true,
})

export const createMessageAnnotation = async (
  input: CreateMessageAnnotationInput,
): Promise<MessageAnnotationRecord> => {
  const result = await query<MessageAnnotationRow>(
    createMessageAnnotationSql,
    createMessageAnnotationParams(input),
  )

  if (result.rows.length === 0) {
    throw new Error('Message not found or target node is outside message workspace')
  }

  return mapMessageAnnotationRow(result.rows[0])
}

export const createMessageAnnotationForAuthor = async (
  input: CreateMessageAnnotationForAuthorInput,
): Promise<MessageAnnotationRecord | null> => {
  const result = await query<MessageAnnotationRow>(
    createMessageAnnotationForAuthorSql,
    createMessageAnnotationParams(input),
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageAnnotationRow(result.rows[0])
}

const buildLinkMessageAnnotationSql = (options: { scopedToWorkspaceOwner: boolean }): string => {
  const ownershipGuard = options.scopedToWorkspaceOwner ? 'AND w.author_user_id = $3' : ''

  return `
    UPDATE message_annotations a
    SET leads_to_node_id = $2
    FROM messages m
    JOIN nodes source_node ON source_node.id = m.node_id
    JOIN workspaces w ON w.id = source_node.workspace_id
    LEFT JOIN nodes target_node ON target_node.id = $2
    WHERE a.id = $1
      AND a.message_id = m.id
      ${ownershipGuard}
      AND a.deleted_at IS NULL
      AND ($2::uuid IS NULL OR target_node.workspace_id = source_node.workspace_id)
    RETURNING
      ${scopedMessageAnnotationColumns}
  `
}

const linkMessageAnnotationSql = buildLinkMessageAnnotationSql({
  scopedToWorkspaceOwner: false,
})

const linkMessageAnnotationForAuthorSql = buildLinkMessageAnnotationSql({
  scopedToWorkspaceOwner: true,
})

export const linkMessageAnnotationToNode = async (
  input: UpdateMessageAnnotationLinkInput,
): Promise<MessageAnnotationRecord | null> => {
  const result = await query<MessageAnnotationRow>(linkMessageAnnotationSql, [
    input.id,
    input.leadsToNodeId,
  ])

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageAnnotationRow(result.rows[0])
}

export const linkMessageAnnotationToNodeForAuthor = async (
  input: UpdateMessageAnnotationLinkInput,
  authorUserId: string,
): Promise<MessageAnnotationRecord | null> => {
  const result = await query<MessageAnnotationRow>(linkMessageAnnotationForAuthorSql, [
    input.id,
    input.leadsToNodeId,
    authorUserId,
  ])

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageAnnotationRow(result.rows[0])
}

export const softDeleteMessageAnnotation = async (
  id: string,
): Promise<{ id: string } | null> => {
  const result = await query<{ id: string }>(
    `
    UPDATE message_annotations
    SET deleted_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return { id: result.rows[0].id }
}

export const softDeleteMessageAnnotationForAuthor = async (
  id: string,
  authorUserId: string,
): Promise<{ id: string } | null> => {
  const result = await query<{ id: string }>(
    `
    UPDATE message_annotations a
    SET deleted_at = NOW()
    FROM messages m
    JOIN nodes n ON n.id = m.node_id
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE a.id = $1
      AND a.message_id = m.id
      AND w.author_user_id = $2
      AND a.deleted_at IS NULL
    RETURNING a.id
    `,
    [id, authorUserId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return { id: result.rows[0].id }
}
