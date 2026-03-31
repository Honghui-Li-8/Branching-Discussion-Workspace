import type { RetrievedChunk } from '@branching/shared'
import type { AssistantPrompt, ConversationContext } from './types.js'

const formatRecentMessages = (context: ConversationContext): string => {
  if (context.recentMessages.length === 0) {
    return 'No prior messages in this node.'
  }

  return context.recentMessages
    .map((message) => `[${message.role}] ${message.content}`)
    .join('\n')
}

const formatRetrievedChunks = (chunks: RetrievedChunk[]): string =>
  chunks
    .map(
      (chunk, index) =>
        `[source ${index + 1} | message=${chunk.messageId} | chunk=${chunk.chunkIndex}] ${chunk.content}`,
    )
    .join('\n\n')

export const buildAssistantPrompt = (
  context: ConversationContext,
  options: {
    retrievedChunks?: RetrievedChunk[]
  } = {},
): AssistantPrompt => {
  const sections = [
    `Node title: ${context.node.title}`,
    `Node summary: ${context.node.summary}`,
    `Node status: ${context.node.status}`,
    `Node confidence: ${context.node.confidence}`,
    'Recent messages:',
    formatRecentMessages(context),
  ]

  if ((options.retrievedChunks?.length ?? 0) > 0) {
    sections.push('Retrieved context:')
    sections.push(formatRetrievedChunks(options.retrievedChunks ?? []))
  }

  sections.push(`User input: ${context.userInput}`)

  return {
    input: sections.join('\n'),
    userInput: context.userInput,
  }
}
