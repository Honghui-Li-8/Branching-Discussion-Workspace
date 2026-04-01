import type { RetrievedChunk } from '@branching/shared'
import type { AssistantPrompt, ConversationContext } from './types.js'

const formatRecentMessages = (messages: ConversationContext['recentMessages']): string => {
  if (messages.length === 0) {
    return 'No prior messages in this node.'
  }

  return messages.map((message) => `[${message.role}] ${message.content}`).join('\n')
}

const formatRetrievedChunks = (chunks: RetrievedChunk[]): string =>
  chunks
    .map(
      (chunk, index) =>
        `[source ${index + 1} | message=${chunk.messageId} | chunk=${chunk.chunkIndex}] ${chunk.content}`,
    )
    .join('\n\n')

const buildLegacyPromptInput = (
  instructions: string[],
  conversation: ConversationContext['recentMessages'],
  currentUserMessage: string,
  retrievedChunks: RetrievedChunk[],
): string => {
  const sections = [...instructions, 'Recent messages:', formatRecentMessages(conversation)]

  if (retrievedChunks.length > 0) {
    sections.push('Retrieved context:')
    sections.push(formatRetrievedChunks(retrievedChunks))
  }

  sections.push(`User input: ${currentUserMessage}`)

  return sections.join('\n')
}

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
    input: buildLegacyPromptInput(
      instructions,
      conversation,
      context.userInput,
      options.retrievedChunks ?? [],
    ),
    userInput: context.userInput,
  }
}
