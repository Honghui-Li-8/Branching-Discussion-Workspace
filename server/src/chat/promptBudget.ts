import type { RetrievedChunk } from '@branching/shared'
import type {
  ConversationContextMessage,
  PromptEnvelope,
} from './types.js'

export type PromptBudgetOptions = {
  maxConversationTokens?: number
  maxRetrievalTokens?: number
  maxRetrievalChunks?: number
}

export type PromptBudgetSummary = {
  instructionCount: number
  conversationCountBefore: number
  conversationCountAfter: number
  retrievalCountBefore: number
  retrievalCountAfter: number
  estimatedTokensBefore: number
  estimatedTokensAfter: number
  trimmedConversationCount: number
  trimmedRetrievalCount: number
}

type TrimmedConversation = {
  conversation: ConversationContextMessage[]
  estimatedTokens: number
}

type TrimmedRetrievalContext = {
  retrievalContext: RetrievedChunk[]
  estimatedTokens: number
}

export type PromptBudgetResult = {
  prompt: PromptEnvelope
  summary: PromptBudgetSummary
}

const DEFAULT_MAX_CONVERSATION_TOKENS = 3200
const DEFAULT_MAX_RETRIEVAL_TOKENS = 1200
const DEFAULT_MAX_RETRIEVAL_CHUNKS = 6
const TOKEN_CHARS_PER_UNIT = 4
const MESSAGE_OVERHEAD_TOKENS = 4
const CHUNK_OVERHEAD_TOKENS = 4

const estimateTextTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / TOKEN_CHARS_PER_UNIT))

const estimateInstructionsTokens = (instructions: string[]): number =>
  instructions.reduce((total, instruction) => total + estimateTextTokens(instruction), 0)

const estimateConversationMessageTokens = (message: ConversationContextMessage): number =>
  estimateTextTokens(message.content) + MESSAGE_OVERHEAD_TOKENS

const estimateRetrievalChunkTokens = (chunk: RetrievedChunk): number =>
  (Number.isFinite(chunk.tokenCount) && (chunk.tokenCount ?? 0) > 0
    ? Math.floor(chunk.tokenCount ?? 0)
    : estimateTextTokens(chunk.content)) + CHUNK_OVERHEAD_TOKENS

const estimatePromptTokens = (prompt: PromptEnvelope): number =>
  estimateInstructionsTokens(prompt.instructions) +
  prompt.conversation.reduce((total, message) => total + estimateConversationMessageTokens(message), 0) +
  prompt.retrievalContext.reduce((total, chunk) => total + estimateRetrievalChunkTokens(chunk), 0) +
  estimateTextTokens(prompt.currentUserMessage)

const trimConversation = (
  conversation: ConversationContextMessage[],
  maxConversationTokens: number,
): TrimmedConversation => {
  if (conversation.length === 0) {
    return {
      conversation: [],
      estimatedTokens: 0,
    }
  }

  const retainedMessages: ConversationContextMessage[] = []
  let retainedTokens = 0

  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const message = conversation[index]
    const messageTokens = estimateConversationMessageTokens(message)

    if (retainedMessages.length > 0 && retainedTokens + messageTokens > maxConversationTokens) {
      continue
    }

    if (retainedMessages.length === 0 && messageTokens > maxConversationTokens && maxConversationTokens > 0) {
      retainedMessages.push(message)
      retainedTokens = messageTokens
      break
    }

    retainedMessages.push(message)
    retainedTokens += messageTokens
  }

  return {
    conversation: retainedMessages.reverse(),
    estimatedTokens: retainedTokens,
  }
}

const trimRetrievalContext = (
  retrievalContext: RetrievedChunk[],
  maxRetrievalTokens: number,
  maxRetrievalChunks: number,
): TrimmedRetrievalContext => {
  if (retrievalContext.length === 0) {
    return {
      retrievalContext: [],
      estimatedTokens: 0,
    }
  }

  const retainedChunks: RetrievedChunk[] = []
  let retainedTokens = 0

  for (const chunk of retrievalContext) {
    if (retainedChunks.length >= maxRetrievalChunks) {
      break
    }

    const chunkTokens = estimateRetrievalChunkTokens(chunk)

    if (retainedChunks.length > 0 && retainedTokens + chunkTokens > maxRetrievalTokens) {
      continue
    }

    if (retainedChunks.length === 0 && chunkTokens > maxRetrievalTokens && maxRetrievalTokens > 0) {
      retainedChunks.push(chunk)
      retainedTokens = chunkTokens
      break
    }

    retainedChunks.push(chunk)
    retainedTokens += chunkTokens
  }

  return {
    retrievalContext: retainedChunks,
    estimatedTokens: retainedTokens,
  }
}

export const applyPromptBudget = (
  prompt: PromptEnvelope,
  options: PromptBudgetOptions = {},
): PromptBudgetResult => {
  const maxConversationTokens = options.maxConversationTokens ?? DEFAULT_MAX_CONVERSATION_TOKENS
  const maxRetrievalTokens = options.maxRetrievalTokens ?? DEFAULT_MAX_RETRIEVAL_TOKENS
  const maxRetrievalChunks = options.maxRetrievalChunks ?? DEFAULT_MAX_RETRIEVAL_CHUNKS
  const conversationBefore = prompt.conversation.length
  const retrievalBefore = prompt.retrievalContext.length
  const conversationTrim = trimConversation(prompt.conversation, maxConversationTokens)
  const retrievalTrim = trimRetrievalContext(
    prompt.retrievalContext,
    maxRetrievalTokens,
    maxRetrievalChunks,
  )
  const budgetedPrompt: PromptEnvelope = {
    ...prompt,
    conversation: conversationTrim.conversation,
    retrievalContext: retrievalTrim.retrievalContext,
  }

  return {
    prompt: budgetedPrompt,
    summary: {
      instructionCount: prompt.instructions.length,
      conversationCountBefore: conversationBefore,
      conversationCountAfter: budgetedPrompt.conversation.length,
      retrievalCountBefore: retrievalBefore,
      retrievalCountAfter: budgetedPrompt.retrievalContext.length,
      estimatedTokensBefore: estimatePromptTokens(prompt),
      estimatedTokensAfter: estimatePromptTokens(budgetedPrompt),
      trimmedConversationCount: conversationBefore - budgetedPrompt.conversation.length,
      trimmedRetrievalCount: retrievalBefore - budgetedPrompt.retrievalContext.length,
    },
  }
}
