export type MessageRole = 'user' | 'assistant' | 'system'

export interface MessageRecord {
  id: string
  nodeId: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface CreateMessageInput {
  nodeId: string
  role: MessageRole
  content: string
}
