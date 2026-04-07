import { z } from 'zod'
import { messageSchema } from './core.js'

export const conversationTurnStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
])

export const conversationSendInputSchema = z.object({
  nodeId: z.string(),
  text: z.string().min(1),
  model: z.string().min(1),
  idempotencyKey: z.string().min(1),
})

export const conversationSendResultSchema = z.object({
  turnId: z.string(),
  status: conversationTurnStatusSchema,
  userMessage: messageSchema,
  assistantMessage: messageSchema.nullable(),
  error: z.string().nullable(),
})

export type ConversationSendInput = z.infer<typeof conversationSendInputSchema>
export type ConversationSendResult = z.infer<typeof conversationSendResultSchema>
