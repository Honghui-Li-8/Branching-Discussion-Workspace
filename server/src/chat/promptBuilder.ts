import type { RetrievedChunk } from '@branching/shared'
import type { ConversationContext, PromptEnvelope } from './types.js'

const INLINE_RESPONSE_FORMAT_INSTRUCTION = `Response format requirements:
- Answer in clean Markdown format.
    - Use short Markdown headings (## or ###) to organize multi-part answers by default.
    - Use bold lead-ins or bold key conclusions to make important points easy to scan.
    - Use bullet points for collections, and use numbered points when order, priority, or steps matter.
    - For fixed-count or clearly delineated sets, use a numbered top-level list.
    - Avoid long paragraphs. Put thresholds or rules of thumb in a compact list.
    - Wrap code in triple-backtick fenced code blocks and include a language tag when possible.
- Keep responses concise:
    - Start with a high-level response that includes only necessary details.
    - Avoid low-level implementation details unless the user explicitly asks for them or continues with follow-up questions.
    - Avoid long responses on short question`

export const buildAssistantPrompt = (
  context: ConversationContext,
  options: {
    retrievedChunks?: RetrievedChunk[]
  } = {},
): PromptEnvelope => {
  const instructions = [
    `Node title: ${context.node.title}`,
    `Node summary: ${context.node.summary}`,
    `Node status: ${context.node.status}`,
    `Node confidence: ${context.node.confidence}`,
    INLINE_RESPONSE_FORMAT_INSTRUCTION,
  ]
  const conversation = context.recentMessages

  return {
    instructions,
    conversation,
    currentUserMessage: context.userInput,
    retrievalContext: options.retrievedChunks ?? [],
  }
}
