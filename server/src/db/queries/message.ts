import {
  parseMessageMetadata,
  serializeMessageMetadata,
} from '@branching/shared'
import type {
  CreateMessageInput,
  MessageRecord,
  MessageRole,
  UpdateMessageInput,
} from '../models/message.js'
import type { PoolClient } from 'pg'
import { query } from '../client.js'

type MessageRow = {
  id: string
  node_id: string
  author_user_id: string
  turn_id: string | null
  role: MessageRole
  content: string
  metadata: unknown
  created_at: string
}

type MessageBranchSourceContextRow = {
  message_id: string
  parent_node_id: string
  workspace_id: string
}

export type MessageBranchSourceContextRecord = {
  messageId: string
  parentNodeId: string
  workspaceId: string
}

type MessageBranchSourceContextQueryExecutor = (
  sql: string,
  params: unknown[],
) => Promise<{ rows: MessageBranchSourceContextRow[] }>

const mapMessageRow = (row: MessageRow): MessageRecord => ({
  id: row.id,
  authorUserId: row.author_user_id,
  nodeId: row.node_id,
  turnId: row.turn_id,
  role: row.role,
  content: row.content,
  metadata: parseMessageMetadata(row.metadata),
  createdAt: row.created_at,
})

const mapMessageBranchSourceContextRow = (
  row: MessageBranchSourceContextRow,
): MessageBranchSourceContextRecord => ({
  messageId: row.message_id,
  parentNodeId: row.parent_node_id,
  workspaceId: row.workspace_id,
})

const getMessageBranchSourceContextForAuthorWithExecutor = async (
  runQuery: MessageBranchSourceContextQueryExecutor,
  messageId: string,
  authorUserId: string,
): Promise<MessageBranchSourceContextRecord | null> => {
  const result = await runQuery(
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
    [messageId, authorUserId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageBranchSourceContextRow(result.rows[0])
}

export const getMessageBranchSourceContextForAuthor = async (
  messageId: string,
  authorUserId: string,
): Promise<MessageBranchSourceContextRecord | null> =>
  getMessageBranchSourceContextForAuthorWithExecutor(
    (sql, params) => query<MessageBranchSourceContextRow>(sql, params),
    messageId,
    authorUserId,
  )

export const getMessageBranchSourceContextForAuthorInTransaction = async (
  client: Pick<PoolClient, 'query'>,
  messageId: string,
  authorUserId: string,
): Promise<MessageBranchSourceContextRecord | null> =>
  getMessageBranchSourceContextForAuthorWithExecutor(
    (sql, params) => client.query<MessageBranchSourceContextRow>(sql, params),
    messageId,
    authorUserId,
  )

export const listMessagesForNode = async (nodeId: string): Promise<MessageRecord[]> => {
  const result = await query<MessageRow>(
    `
    SELECT id, node_id, author_user_id, turn_id, role, content, metadata, created_at
    FROM messages
    WHERE node_id = $1
    ORDER BY created_at ASC
    `,
    [nodeId],
  )

  return result.rows.map(mapMessageRow)
}

export const listMessagesByTurn = async (turnId: string): Promise<MessageRecord[]> => {
  const result = await query<MessageRow>(
    `
    SELECT
      id,
      node_id,
      author_user_id,
      turn_id,
      role,
      content,
      metadata,
      created_at
    FROM messages
    WHERE turn_id = $1
    ORDER BY created_at ASC
    `,
    [turnId],
  )

  return result.rows.map(mapMessageRow)
}

export const listMessagesForNodeForAuthor = async (
  nodeId: string,
  authorUserId: string,
): Promise<MessageRecord[]> => {
  const result = await query<MessageRow>(
    `
    SELECT
      m.id,
      m.node_id,
      m.author_user_id,
      m.turn_id,
      m.role,
      m.content,
      m.metadata,
      m.created_at
    FROM messages m
    JOIN nodes n ON n.id = m.node_id
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE m.node_id = $1
      AND w.author_user_id = $2
    ORDER BY m.created_at ASC
    `,
    [nodeId, authorUserId],
  )

  return result.rows.map(mapMessageRow)
}

export const getMessageById = async (id: string): Promise<MessageRecord | null> => {
  const result = await query<MessageRow>(
    `
    SELECT id, node_id, author_user_id, turn_id, role, content, metadata, created_at
    FROM messages
    WHERE id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageRow(result.rows[0])
}

export const getMessageByIdForAuthor = async (
  id: string,
  authorUserId: string,
): Promise<MessageRecord | null> => {
  const result = await query<MessageRow>(
    `
    SELECT
      m.id,
      m.node_id,
      m.author_user_id,
      m.turn_id,
      m.role,
      m.content,
      m.metadata,
      m.created_at
    FROM messages m
    JOIN nodes n ON n.id = m.node_id
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE m.id = $1
      AND w.author_user_id = $2
    `,
    [id, authorUserId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageRow(result.rows[0])
}

export const messageExists = async (id: string): Promise<boolean> => {
  const result = await query<{ id: string }>(
    `
    SELECT id
    FROM messages
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  )
  return result.rows.length > 0
}

export const createMessage = async (input: CreateMessageInput): Promise<MessageRecord> => {
  const hasTurnId = input.turnId !== undefined && input.turnId !== null
  const metadata = JSON.stringify(serializeMessageMetadata(input.metadata))
  const result = await query<MessageRow>(
    `
    WITH target_turn AS (
      SELECT id
      FROM conversation_turns
      WHERE id = $6
        AND node_id = $1
        AND author_user_id = $2
    )
    INSERT INTO messages (node_id, author_user_id, role, content, turn_id, metadata)
    SELECT
      $1,
      $2,
      $3,
      $4,
      CASE WHEN $5::boolean THEN target_turn.id ELSE NULL END,
      $7::jsonb
    FROM nodes
    LEFT JOIN target_turn ON TRUE
    WHERE id = $1
      AND ($5::boolean = FALSE OR target_turn.id IS NOT NULL)
    RETURNING id, node_id, author_user_id, turn_id, role, content, metadata, created_at
    `,
    [
      input.nodeId,
      input.authorUserId,
      input.role,
      input.content,
      hasTurnId,
      input.turnId ?? null,
      metadata,
    ],
  )

  if (result.rows.length === 0) {
    throw new Error('Node not found')
  }

  return mapMessageRow(result.rows[0])
}

export const createMessageForAuthor = async (input: CreateMessageInput): Promise<MessageRecord | null> => {
  const hasTurnId = input.turnId !== undefined && input.turnId !== null
  const metadata = JSON.stringify(serializeMessageMetadata(input.metadata))
  const result = await query<MessageRow>(
    `
    WITH target_turn AS (
      SELECT ct.id
      FROM conversation_turns ct
      WHERE ct.id = $6
        AND ct.node_id = $1
        AND ct.author_user_id = $2
    )
    INSERT INTO messages (node_id, author_user_id, role, content, turn_id, metadata)
    SELECT
      $1,
      $2,
      $3,
      $4,
      CASE WHEN $5::boolean THEN target_turn.id ELSE NULL END,
      $7::jsonb
    FROM nodes n
    JOIN workspaces w ON w.id = n.workspace_id
    LEFT JOIN target_turn ON TRUE
    WHERE n.id = $1
      AND w.author_user_id = $2
      AND ($5::boolean = FALSE OR target_turn.id IS NOT NULL)
    RETURNING id, node_id, author_user_id, turn_id, role, content, metadata, created_at
    `,
    [
      input.nodeId,
      input.authorUserId,
      input.role,
      input.content,
      hasTurnId,
      input.turnId ?? null,
      metadata,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageRow(result.rows[0])
}

export const updateMessage = async (input: UpdateMessageInput): Promise<MessageRecord | null> => {
  const hasMetadata = input.metadata !== undefined
  const metadata = hasMetadata
    ? JSON.stringify(serializeMessageMetadata(input.metadata))
    : null
  const result = await query<MessageRow>(
    `
    UPDATE messages
    SET
      role = CASE WHEN $2::boolean THEN $3 ELSE role END,
      content = CASE WHEN $4::boolean THEN $5 ELSE content END,
      metadata = CASE WHEN $6::boolean THEN $7::jsonb ELSE metadata END
    WHERE id = $1
    RETURNING id, node_id, author_user_id, turn_id, role, content, metadata, created_at
    `,
    [
      input.id,
      input.role !== undefined,
      input.role ?? null,
      input.content !== undefined,
      input.content ?? null,
      hasMetadata,
      metadata,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageRow(result.rows[0])
}

export const updateMessageForAuthor = async (
  input: UpdateMessageInput,
  authorUserId: string,
): Promise<MessageRecord | null> => {
  const hasMetadata = input.metadata !== undefined
  const metadata = hasMetadata
    ? JSON.stringify(serializeMessageMetadata(input.metadata))
    : null
  const result = await query<MessageRow>(
    `
    UPDATE messages m
    SET
      role = CASE WHEN $2::boolean THEN $3 ELSE m.role END,
      content = CASE WHEN $4::boolean THEN $5 ELSE m.content END,
      metadata = CASE WHEN $6::boolean THEN $7::jsonb ELSE m.metadata END
    FROM nodes n
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE m.id = $1
      AND n.id = m.node_id
      AND w.author_user_id = $8
    RETURNING m.id, m.node_id, m.author_user_id, m.turn_id, m.role, m.content, m.metadata, m.created_at
    `,
    [
      input.id,
      input.role !== undefined,
      input.role ?? null,
      input.content !== undefined,
      input.content ?? null,
      hasMetadata,
      metadata,
      authorUserId,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapMessageRow(result.rows[0])
}

type DeletedMessageRow = {
  id: string
}

export const deleteMessage = async (id: string): Promise<{ id: string } | null> => {
  const result = await query<DeletedMessageRow>(
    `
    DELETE FROM messages
    WHERE id = $1
    RETURNING id
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return { id: result.rows[0].id }
}

export const deleteMessageForAuthor = async (
  id: string,
  authorUserId: string,
): Promise<{ id: string } | null> => {
  const result = await query<DeletedMessageRow>(
    `
    DELETE FROM messages m
    USING nodes n, workspaces w
    WHERE m.id = $1
      AND n.id = m.node_id
      AND w.id = n.workspace_id
      AND w.author_user_id = $2
    RETURNING m.id
    `,
    [id, authorUserId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return { id: result.rows[0].id }
}
