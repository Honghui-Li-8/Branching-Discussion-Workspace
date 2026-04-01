import type { RetrievedChunk } from '@branching/shared'
import type { PromptEnvelope } from './types.js'

export type PromptSectionMetrics = {
  instructionCount: number
  instructionTextLength: number
  conversationTurnCount: number
  conversationTextLength: number
  retrievalContextCount: number
  retrievalContextTextLength: number
  currentUserMessageLength: number
  totalPromptTextLength: number
}

const sumTextLength = (values: readonly string[]): number =>
  values.reduce((total, value) => total + value.length, 0)

const sumChunkTextLength = (chunks: readonly RetrievedChunk[]): number =>
  sumTextLength(chunks.map((chunk) => chunk.content))

export const summarizePromptSections = (
  prompt: PromptEnvelope,
): PromptSectionMetrics => {
  const instructionTextLength = sumTextLength(prompt.instructions)
  const conversationTextLength = sumTextLength(
    prompt.conversation.map((message) => message.content),
  )
  const retrievalContextTextLength = sumChunkTextLength(prompt.retrievalContext)
  const currentUserMessageLength = prompt.currentUserMessage.length

  return {
    instructionCount: prompt.instructions.length,
    instructionTextLength,
    conversationTurnCount: prompt.conversation.length,
    conversationTextLength,
    retrievalContextCount: prompt.retrievalContext.length,
    retrievalContextTextLength,
    currentUserMessageLength,
    totalPromptTextLength:
      instructionTextLength +
      conversationTextLength +
      retrievalContextTextLength +
      currentUserMessageLength,
  }
}
