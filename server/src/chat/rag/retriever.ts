import type { RetrieverInput, RetrieverResult } from '@branching/shared'
import { getRagConfig, type RagConfig, type RagRetrieverStrategy } from '../config.js'

export interface Retriever {
  readonly id: string
  retrieve: (input: RetrieverInput) => Promise<RetrieverResult>
}

export class NoopRetriever implements Retriever {
  readonly id = 'noop'

  async retrieve(_input: RetrieverInput): Promise<RetrieverResult> {
    // Minimal placeholder RAG: retrieval hook is live, initial strategy is intentionally simple and low-risk.
    return {
      chunks: [],
      diagnostics: {
        retriever: this.id,
        totalChunks: 0,
        selectedChunks: 0,
        fallbackReason: 'retrieval_disabled',
      },
    }
  }
}

type RetrieverRegistry = Partial<Record<RagRetrieverStrategy, Retriever>>

export type ResolveRetrieverOptions = {
  config?: RagConfig
  registry?: RetrieverRegistry
}

export const createRetrieverRegistry = (
  overrides: RetrieverRegistry = {},
): RetrieverRegistry => ({
  noop: new NoopRetriever(),
  ...overrides,
})

export const resolveRetriever = (
  options: ResolveRetrieverOptions = {},
): Retriever => {
  const config = options.config ?? getRagConfig()
  const registry = options.registry ?? createRetrieverRegistry()

  return registry[config.retriever] ?? registry.noop ?? new NoopRetriever()
}
