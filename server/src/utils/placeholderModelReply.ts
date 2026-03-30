/**
 * Temporary local placeholder for assistant generation.
 * This will be replaced by an LLM call when model integration is added.
 */
export const buildPlaceholderAssistantReply = (userMessage: string): string => {
  const normalizedMessage = userMessage.trim()
  return `echo - ${normalizedMessage}`
}
