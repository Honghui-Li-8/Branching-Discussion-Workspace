import { describe, expect, test } from '@jest/globals'
import type { Retriever } from './retriever'
import {
  NoopRetriever,
  createRetrieverRegistry,
  resolveRetriever,
} from './retriever'
import { VectorRetrieverV1 } from './vectorRetriever'

const retrieverInput = {
  query: 'hello',
  nodeId: 'n1',
  authorUserId: 'u1',
}

describe('rag retriever registry', () => {
  test('NoopRetriever returns an empty result with diagnostics', async () => {
    const retriever = new NoopRetriever()

    await expect(retriever.retrieve(retrieverInput)).resolves.toEqual({
      chunks: [],
      diagnostics: {
        retriever: 'noop',
        totalChunks: 0,
        selectedChunks: 0,
        fallbackReason: 'retrieval_disabled',
      },
    })
  })

  test('createRetrieverRegistry registers noop by default', () => {
    const registry = createRetrieverRegistry()

    expect(registry.noop).toBeInstanceOf(NoopRetriever)
    expect(registry.vector_v1).toBeInstanceOf(VectorRetrieverV1)
  })

  test('resolveRetriever returns configured retriever when it exists', () => {
    const vectorRetriever: Retriever = {
      id: 'vector_v1',
      retrieve: async () => ({ chunks: [] }),
    }

    const retriever = resolveRetriever({
      config: {
        enabled: true,
        retriever: 'vector_v1',
        embeddingModel: 'text-embedding-3-small',
        maxChunks: 4,
        maxRetrievalTokens: 1200,
        scoreThreshold: 0,
        allowedUserIds: [],
        allowedWorkspaceIds: [],
      },
      registry: createRetrieverRegistry({
        vector_v1: vectorRetriever,
      }),
    })

    expect(retriever).toBe(vectorRetriever)
  })

  test('resolveRetriever falls back to noop when configured retriever is unavailable', () => {
    const retriever = resolveRetriever({
      config: {
        enabled: true,
        retriever: 'vector_v1',
        embeddingModel: 'text-embedding-3-small',
        maxChunks: 4,
        maxRetrievalTokens: 1200,
        scoreThreshold: 0,
        allowedUserIds: [],
        allowedWorkspaceIds: [],
      },
      registry: {
        noop: new NoopRetriever(),
      },
    })

    expect(retriever.id).toBe('noop')
  })
})
