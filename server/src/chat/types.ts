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

export interface AssistantPrompt {
  input: string
  userInput: string
}

export interface GenerateAssistantInput {
  model: string
  prompt: AssistantPrompt
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
