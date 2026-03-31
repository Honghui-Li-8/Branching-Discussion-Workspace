export interface ConversationTurnEventRecord {
  id: number
  turnId: string
  seq: number
  eventType: string
  payload: unknown
  createdAt: string
}

export interface AppendConversationTurnEventInput {
  turnId: string
  seq: number
  eventType: string
  payload?: unknown
}
