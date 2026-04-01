import type {
  ConversationContextMessage,
  ConversationMemoryPlaceholder,
} from './types.js'

type BuildConversationMemoryPlaceholderInput = {
  olderMessageCount: number
  recentMessages: ConversationContextMessage[]
}

export const buildConversationMemoryPlaceholder = (
  input: BuildConversationMemoryPlaceholderInput,
): ConversationMemoryPlaceholder | null => {
  if (input.olderMessageCount <= 0) {
    return null
  }

  return {
    status: 'pending',
    olderMessageCount: input.olderMessageCount,
    retainedMessageCount: input.recentMessages.length,
  }
}
