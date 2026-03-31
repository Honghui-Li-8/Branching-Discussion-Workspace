import { query } from '../client.js'
import type {
  AppendConversationTurnEventInput,
  ConversationTurnEventRecord,
} from '../models/conversationTurnEvent.js'

type ConversationTurnEventRow = {
  id: string | number
  turn_id: string
  seq: number
  event_type: string
  payload: unknown
  created_at: string
}

const mapConversationTurnEventRow = (
  row: ConversationTurnEventRow,
): ConversationTurnEventRecord => ({
  id: Number(row.id),
  turnId: row.turn_id,
  seq: row.seq,
  eventType: row.event_type,
  payload: row.payload,
  createdAt: row.created_at,
})

export const appendConversationTurnEvent = async (
  input: AppendConversationTurnEventInput,
): Promise<ConversationTurnEventRecord | null> => {
  const result = await query<ConversationTurnEventRow>(
    `
    INSERT INTO conversation_turn_event (
      turn_id,
      seq,
      event_type,
      payload
    )
    SELECT
      ct.id,
      $2,
      $3,
      $4::jsonb
    FROM conversation_turns ct
    WHERE ct.id = $1
    RETURNING
      id,
      turn_id,
      seq,
      event_type,
      payload,
      created_at
    `,
    [
      input.turnId,
      input.seq,
      input.eventType,
      JSON.stringify(input.payload ?? {}),
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationTurnEventRow(result.rows[0])
}

export const getMaxConversationTurnEventSeq = async (
  turnId: string,
): Promise<number> => {
  const result = await query<{ max_seq: number | null }>(
    `
    SELECT COALESCE(MAX(seq), 0) AS max_seq
    FROM conversation_turn_event
    WHERE turn_id = $1
    `,
    [turnId],
  )

  if (result.rows.length === 0) {
    return 0
  }

  return result.rows[0].max_seq ?? 0
}

export const listConversationTurnEventsAfterId = async (
  turnId: string,
  afterEventId: number,
  limit = 100,
): Promise<ConversationTurnEventRecord[]> => {
  const result = await query<ConversationTurnEventRow>(
    `
    SELECT
      id,
      turn_id,
      seq,
      event_type,
      payload,
      created_at
    FROM conversation_turn_event
    WHERE turn_id = $1
      AND id > $2
    ORDER BY id ASC
    LIMIT $3
    `,
    [turnId, Math.max(0, afterEventId), Math.max(1, limit)],
  )

  return result.rows.map(mapConversationTurnEventRow)
}
