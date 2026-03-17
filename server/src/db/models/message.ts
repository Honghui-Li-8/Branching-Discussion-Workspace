export type MessageRole = 'user' | 'assistant' | 'system'

export interface MessageRecord {
  id: string
  authorUserId: string
  nodeId: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface CreateMessageInput {
  authorUserId: string
  nodeId: string
  role: MessageRole
  content: string
}
