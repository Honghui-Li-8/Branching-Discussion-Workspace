import type { CreateMessageInput, MessageRecord, MessageRole } from '../models/message.js'
import { query } from '../client.js'

type MessageRow = {
  id: string
  node_id: string
  role: MessageRole
  content: string
  created_at: string
}

const mapMessageRow = (row: MessageRow): MessageRecord => ({
  id: row.id,
  nodeId: row.node_id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
})

export const listMessagesForNode = async (nodeId: string): Promise<MessageRecord[]> => {
  const result = await query<MessageRow>(
    `
    SELECT id, node_id, role, content, created_at
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
    INSERT INTO messages (node_id, role, content)
    VALUES ($1, $2, $3)
    RETURNING id, node_id, role, content, created_at
    `,
    [input.nodeId, input.role, input.content],
  )

  return mapMessageRow(result.rows[0])
}
