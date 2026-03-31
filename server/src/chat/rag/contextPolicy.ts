import { randomUUID } from 'node:crypto'
import type {
  Citation,
  ContextSnapshot,
  RetrievedChunk,
  RetrieverDiagnostics,
  RetrieverResult,
} from '@branching/shared'
import { getRagConfig, type RagConfig } from '../config.js'

const DEFAULT_SAFETY_MARGIN_TOKENS = 100

export interface ContextPolicyDecision {
  selectedChunks: RetrievedChunk[]
  citations: Citation[]
  snapshot: ContextSnapshot
  diagnostics: RetrieverDiagnostics | undefined
}

type ApplyContextPolicyOptions = {
  config?: RagConfig
  safetyMarginTokens?: number
  now?: Date
}

const estimateTokenCount = (chunk: RetrievedChunk): number => {
  if (
    typeof chunk.tokenCount === 'number' &&
    Number.isInteger(chunk.tokenCount) &&
    chunk.tokenCount >= 0
  ) {
    return chunk.tokenCount
  }

  return Math.max(1, Math.ceil(chunk.content.length / 4))
}

const buildCitations = (chunks: RetrievedChunk[]): Citation[] =>
  chunks.map((chunk) => ({
    messageId: chunk.messageId,
    nodeId: chunk.nodeId,
    chunkIndex: chunk.chunkIndex,
    excerpt: chunk.content,
    score: chunk.score,
  }))

export const applyContextPolicy = (
  result: RetrieverResult,
  options: ApplyContextPolicyOptions = {},
): ContextPolicyDecision => {
  const config = options.config ?? getRagConfig()
  const safetyMarginTokens = options.safetyMarginTokens ?? DEFAULT_SAFETY_MARGIN_TOKENS
  const tokenBudget = Math.max(0, config.maxRetrievalTokens - safetyMarginTokens)
  const selectedChunks: RetrievedChunk[] = []

  let runningTokenCount = 0
  for (const chunk of result.chunks) {
    if (selectedChunks.length >= config.maxChunks) {
      break
    }

    const nextTokenCount = estimateTokenCount(chunk)
    if (selectedChunks.length > 0 && runningTokenCount + nextTokenCount > tokenBudget) {
      continue
    }
    if (selectedChunks.length === 0 && nextTokenCount > tokenBudget && tokenBudget > 0) {
      selectedChunks.push({
        ...chunk,
        tokenCount: nextTokenCount,
      })
      runningTokenCount = nextTokenCount
      break
    }

    selectedChunks.push({
      ...chunk,
      tokenCount: nextTokenCount,
    })
    runningTokenCount += nextTokenCount
  }

  const citations = buildCitations(selectedChunks)
  const snapshot: ContextSnapshot = {
    id: randomUUID(),
    chunks: selectedChunks,
    totalTokenCount: runningTokenCount,
    createdAt: (options.now ?? new Date()).toISOString(),
  }

  return {
    selectedChunks,
    citations,
    snapshot,
    diagnostics: result.diagnostics
      ? {
          ...result.diagnostics,
          selectedChunks: selectedChunks.length,
        }
      : undefined,
  }
}
