import type { RetrievedChunk } from '@branching/shared'
import type {
  ConversationTurnStatus,
  MessageRecord,
  NodeRecord,
} from '../db/models/index.js'

export type SendConversationTurnInput = {
  nodeId: string
  text: string
  model: string
  idempotencyKey: string
}

export type ConversationContextNode = Pick<
  NodeRecord,
  | 'id'
  | 'workspaceId'
  | 'title'
  | 'summary'
  | 'status'
  | 'confidence'
  | 'conclusion'
  | 'rationale'
  | 'depth'
  | 'parentNodeId'
>

export type ConversationContextMessage = Pick<
  MessageRecord,
  'id' | 'role' | 'content' | 'createdAt'
>

export interface ConversationContext {
  node: ConversationContextNode
  recentMessages: ConversationContextMessage[]
  userInput: string
}

export interface PromptEnvelope {
  instructions: string[]
  conversation: ConversationContextMessage[]
  currentUserMessage: string
  retrievalContext: RetrievedChunk[]
}

export interface GenerateAssistantInput {
  model: string
  prompt: PromptEnvelope
  onTokenDelta?: (delta: string) => void | Promise<void>
}

export interface GenerateAssistantResult {
  content: string
  finishReason: 'stop' | 'length' | 'content_filter' | 'error'
  providerResponseId?: string | null
}

export interface SendConversationTurnResult {
  turnId: string
  status: ConversationTurnStatus
  userMessage: MessageRecord
  assistantMessage: MessageRecord | null
  error: string | null
}
