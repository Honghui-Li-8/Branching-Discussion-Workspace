export type ConversationTurnStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ConversationTurnRecord {
  id: string
  nodeId: string
  authorUserId: string
  status: ConversationTurnStatus
  model: string
  idempotencyKey: string
  error: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateConversationTurnInput {
  nodeId: string
  authorUserId: string
  status?: ConversationTurnStatus
  model: string
  idempotencyKey: string
  error?: string | null
  completedAt?: string | null
}

export interface UpdateConversationTurnInput {
  id: string
  status?: ConversationTurnStatus
  error?: string | null
  completedAt?: string | null
}

export interface CreateOrGetConversationTurnResult {
  turn: ConversationTurnRecord
  wasCreated: boolean
}
