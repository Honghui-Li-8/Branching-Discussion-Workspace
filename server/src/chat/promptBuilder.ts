import type { RetrievedChunk } from '@branching/shared'
import type { AssistantPrompt, ConversationContext } from './types.js'

export const buildAssistantPrompt = (
  context: ConversationContext,
  options: {
    retrievedChunks?: RetrievedChunk[]
  } = {},
): AssistantPrompt => {
  const instructions = [
    `Node title: ${context.node.title}`,
    `Node summary: ${context.node.summary}`,
    `Node status: ${context.node.status}`,
    `Node confidence: ${context.node.confidence}`,
  ]
  const conversation = context.recentMessages

  return {
    instructions,
    conversation,
    currentUserMessage: context.userInput,
    retrievalContext: options.retrievedChunks ?? [],
  }
}
