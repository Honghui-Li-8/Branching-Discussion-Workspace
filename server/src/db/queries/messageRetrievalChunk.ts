import type {
  MessageRetrievalChunkRecord,
  UpsertMessageRetrievalChunkInput,
} from '../models/messageRetrievalChunk.js'
import { query } from '../client.js'

type MessageRetrievalChunkRow = {
  id: string
  message_id: string
  node_id: string
  author_user_id: string
  chunk_index: number
  content: string
  token_count: number
  created_at: string
  updated_at: string
}

const mapMessageRetrievalChunkRow = (
  row: MessageRetrievalChunkRow,
): MessageRetrievalChunkRecord => ({
  id: row.id,
  messageId: row.message_id,
  nodeId: row.node_id,
  authorUserId: row.author_user_id,
  chunkIndex: row.chunk_index,
  content: row.content,
  tokenCount: row.token_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const toVectorLiteral = (embedding: number[]): string => {
  if (embedding.length === 0) {
    throw new Error('Embedding vector cannot be empty.')
  }

  const serialized = embedding.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error('Embedding vector contains a non-finite value.')
    }
    return String(value)
  })

  return `[${serialized.join(',')}]`
}

export const upsertMessageRetrievalChunk = async (
  input: UpsertMessageRetrievalChunkInput,
): Promise<MessageRetrievalChunkRecord> => {
  const result = await query<MessageRetrievalChunkRow>(
    `
    INSERT INTO message_retrieval_chunk (
      message_id,
      node_id,
      author_user_id,
      chunk_index,
      content,
      token_count,
      embedding
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
    ON CONFLICT (message_id, chunk_index)
    DO UPDATE SET
      node_id = EXCLUDED.node_id,
      author_user_id = EXCLUDED.author_user_id,
      content = EXCLUDED.content,
      token_count = EXCLUDED.token_count,
      embedding = EXCLUDED.embedding,
      updated_at = NOW()
    RETURNING
      id,
      message_id,
      node_id,
      author_user_id,
      chunk_index,
      content,
      token_count,
      created_at,
      updated_at
    `,
    [
      input.messageId,
      input.nodeId,
      input.authorUserId,
      input.chunkIndex,
      input.content,
      input.tokenCount,
      toVectorLiteral(input.embedding),
    ],
  )

  return mapMessageRetrievalChunkRow(result.rows[0])
}

export const listMessageRetrievalChunksByMessageId = async (
  messageId: string,
): Promise<MessageRetrievalChunkRecord[]> => {
  const result = await query<MessageRetrievalChunkRow>(
    `
    SELECT
      id,
      message_id,
      node_id,
      author_user_id,
      chunk_index,
      content,
      token_count,
      created_at,
      updated_at
    FROM message_retrieval_chunk
    WHERE message_id = $1
    ORDER BY chunk_index ASC
    `,
    [messageId],
  )

  return result.rows.map(mapMessageRetrievalChunkRow)
}
