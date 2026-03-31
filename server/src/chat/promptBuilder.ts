import type { AssistantPrompt, ConversationContext } from './types.js'

const formatRecentMessages = (context: ConversationContext): string => {
  if (context.recentMessages.length === 0) {
    return 'No prior messages in this node.'
  }

  return context.recentMessages
    .map((message) => `[${message.role}] ${message.content}`)
    .join('\n')
}

export const buildAssistantPrompt = (
  context: ConversationContext,
): AssistantPrompt => ({
  input: [
    `Node title: ${context.node.title}`,
    `Node summary: ${context.node.summary}`,
    `Node status: ${context.node.status}`,
    `Node confidence: ${context.node.confidence}`,
    'Recent messages:',
    formatRecentMessages(context),
    `User input: ${context.userInput}`,
  ].join('\n'),
  userInput: context.userInput,
})
