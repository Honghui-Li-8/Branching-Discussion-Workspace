import type {
  CreateMessageInput,
  MessageRecord,
  MessageRole,
  UpdateMessageInput,
} from '../models/message.js'
import { query } from '../client.js'

type MessageRow = {
  id: string
  node_id: string
  author_user_id: string
  role: MessageRole
  content: string
  created_at: string
}

const mapMessageRow = (row: MessageRow): MessageRecord => ({
  id: row.id,
  authorUserId: row.author_user_id,
  nodeId: row.node_id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
})

export const listMessagesForNode = async (nodeId: string): Promise<MessageRecord[]> => {
  const result = await query<MessageRow>(
    `
    SELECT id, node_id, author_user_id, role, content, created_at
    FROM messages
    WHERE node_id = $1
    ORDER BY created_at ASC
    `,
    [nodeId],
  )

  return result.rows.map(mapMessageRow)
}

export const createMessage = async (input: CreateMessageInput): Promise<MessageRecord> => {
  const result = await query<MessageRow>(
    `
    INSERT INTO messages (node_id, author_user_id, role, content)
    SELECT $1, $2, $3, $4
    FROM nodes
    WHERE id = $1
    RETURNING id, node_id, author_user_id, role, content, created_at
    `,
    [input.nodeId, input.authorUserId, input.role, input.content],
  )

  if (result.rows.length === 0) {
    throw new Error('Node not found')
  }

  return mapMessageRow(result.rows[0])
}

export const updateMessage = async (input: UpdateMessageInput): Promise<MessageRecord | null> => {
  const result = await query<MessageRow>(
    `
    UPDATE messages
    SET
      role = CASE WHEN $2::boolean THEN $3 ELSE role END,
      content = CASE WHEN $4::boolean THEN $5 ELSE content END
    WHERE id = $1
    RETURNING id, node_id, author_user_id, role, content, created_at
    `,
    [
      input.id,
      input.role !== undefined,
      input.role ?? null,
      input.content !== undefined,
      input.content ?? null,
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
