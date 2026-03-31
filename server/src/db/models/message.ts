import type { MessageMetadata } from '@branching/shared'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface MessageRecord {
  id: string
  authorUserId: string
  nodeId: string
  turnId: string | null
  role: MessageRole
  content: string
  metadata: MessageMetadata
  createdAt: string
}

export interface CreateMessageInput {
  authorUserId: string
  nodeId: string
  turnId?: string | null
  role: MessageRole
  content: string
  metadata?: MessageMetadata
}

export interface UpdateMessageInput {
  id: string
  role?: MessageRole
  content?: string
  metadata?: MessageMetadata
}
