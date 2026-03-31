import { TRPCError } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import {
  getRagConfig,
  getAllowedChatModels,
  isRagAllowedForTarget,
  parseAllowedChatModels,
  parseRagRetriever,
  validateAllowedModelOrThrow,
  validateProviderRuntimeConfigOrThrow,
} from './config'

const originalAllowedModels = process.env.CHAT_ALLOWED_MODELS
const originalOpenAiKey = process.env.OPENAI_API_KEY
const originalRagEnabled = process.env.RAG_ENABLED
const originalRagRetriever = process.env.RAG_RETRIEVER
const originalRagEmbeddingModel = process.env.RAG_EMBEDDING_MODEL
const originalRagMaxChunks = process.env.RAG_MAX_CHUNKS
const originalRagMaxRetrievalTokens = process.env.RAG_MAX_RETRIEVAL_TOKENS
const originalRagScoreThreshold = process.env.RAG_SCORE_THRESHOLD
const originalRagAllowedUserIds = process.env.RAG_ALLOWED_USER_IDS
const originalRagAllowedWorkspaceIds = process.env.RAG_ALLOWED_WORKSPACE_IDS

describe('chat config guardrails', () => {
  beforeEach(() => {
    delete process.env.CHAT_ALLOWED_MODELS
    delete process.env.OPENAI_API_KEY
    delete process.env.RAG_ENABLED
    delete process.env.RAG_RETRIEVER
    delete process.env.RAG_EMBEDDING_MODEL
    delete process.env.RAG_MAX_CHUNKS
    delete process.env.RAG_MAX_RETRIEVAL_TOKENS
    delete process.env.RAG_SCORE_THRESHOLD
    delete process.env.RAG_ALLOWED_USER_IDS
    delete process.env.RAG_ALLOWED_WORKSPACE_IDS
  })

  afterEach(() => {
    if (originalAllowedModels === undefined) {
      delete process.env.CHAT_ALLOWED_MODELS
    } else {
      process.env.CHAT_ALLOWED_MODELS = originalAllowedModels
    }

    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey
    }

    if (originalRagEnabled === undefined) {
      delete process.env.RAG_ENABLED
    } else {
      process.env.RAG_ENABLED = originalRagEnabled
    }

    if (originalRagRetriever === undefined) {
      delete process.env.RAG_RETRIEVER
    } else {
      process.env.RAG_RETRIEVER = originalRagRetriever
    }

    if (originalRagEmbeddingModel === undefined) {
      delete process.env.RAG_EMBEDDING_MODEL
    } else {
      process.env.RAG_EMBEDDING_MODEL = originalRagEmbeddingModel
    }

    if (originalRagMaxChunks === undefined) {
      delete process.env.RAG_MAX_CHUNKS
    } else {
      process.env.RAG_MAX_CHUNKS = originalRagMaxChunks
    }

    if (originalRagMaxRetrievalTokens === undefined) {
      delete process.env.RAG_MAX_RETRIEVAL_TOKENS
    } else {
      process.env.RAG_MAX_RETRIEVAL_TOKENS = originalRagMaxRetrievalTokens
    }

    if (originalRagScoreThreshold === undefined) {
      delete process.env.RAG_SCORE_THRESHOLD
    } else {
      process.env.RAG_SCORE_THRESHOLD = originalRagScoreThreshold
    }

    if (originalRagAllowedUserIds === undefined) {
      delete process.env.RAG_ALLOWED_USER_IDS
    } else {
      process.env.RAG_ALLOWED_USER_IDS = originalRagAllowedUserIds
    }

    if (originalRagAllowedWorkspaceIds === undefined) {
      delete process.env.RAG_ALLOWED_WORKSPACE_IDS
    } else {
      process.env.RAG_ALLOWED_WORKSPACE_IDS = originalRagAllowedWorkspaceIds
    }
  })

  test('parseAllowedChatModels normalizes and deduplicates', () => {
    const result = parseAllowedChatModels('GPT-5, gpt-4o, gpt-5,   gpt-4.1 ')
    expect(result).toEqual(['gpt-5', 'gpt-4o', 'gpt-4.1'])
  })

  test('getAllowedChatModels falls back to defaults when env is empty', () => {
    process.env.CHAT_ALLOWED_MODELS = '   '
    expect(getAllowedChatModels()).toEqual(['gpt-5', 'gpt-4o', 'gpt-4.1', 'gpt-4'])
  })

  test('parseRagRetriever falls back to noop for unsupported values', () => {
    expect(parseRagRetriever(undefined)).toBe('noop')
    expect(parseRagRetriever('vector_v1')).toBe('vector_v1')
    expect(parseRagRetriever('unsupported')).toBe('noop')
  })

  test('getRagConfig returns defaults when env vars are unset', () => {
    expect(getRagConfig()).toEqual({
      enabled: false,
      retriever: 'noop',
      embeddingModel: 'text-embedding-3-small',
      maxChunks: 4,
      maxRetrievalTokens: 1200,
      scoreThreshold: 0,
      allowedUserIds: [],
      allowedWorkspaceIds: [],
    })
  })

  test('getRagConfig normalizes configured values and falls back on invalid numbers', () => {
    process.env.RAG_ENABLED = 'true'
    process.env.RAG_RETRIEVER = 'vector_v1'
    process.env.RAG_EMBEDDING_MODEL = ' text-embedding-3-large '
    process.env.RAG_MAX_CHUNKS = '6'
    process.env.RAG_MAX_RETRIEVAL_TOKENS = '-10'
    process.env.RAG_SCORE_THRESHOLD = '0.42'
    process.env.RAG_ALLOWED_USER_IDS = 'u1, u2, u1'
    process.env.RAG_ALLOWED_WORKSPACE_IDS = 'w1, w2'

    expect(getRagConfig()).toEqual({
      enabled: true,
      retriever: 'vector_v1',
      embeddingModel: 'text-embedding-3-large',
      maxChunks: 6,
      maxRetrievalTokens: 1200,
      scoreThreshold: 0.42,
      allowedUserIds: ['u1', 'u2'],
      allowedWorkspaceIds: ['w1', 'w2'],
    })
  })

  test('isRagAllowedForTarget respects explicit user and workspace allowlists', () => {
    expect(
      isRagAllowedForTarget({
        config: {
          enabled: true,
          retriever: 'noop',
          embeddingModel: 'text-embedding-3-small',
          maxChunks: 4,
          maxRetrievalTokens: 1200,
          scoreThreshold: 0,
          allowedUserIds: ['u1'],
          allowedWorkspaceIds: [],
        },
        userId: 'u1',
        workspaceId: 'w1',
      }),
    ).toBe(true)

    expect(
      isRagAllowedForTarget({
        config: {
          enabled: true,
          retriever: 'noop',
          embeddingModel: 'text-embedding-3-small',
          maxChunks: 4,
          maxRetrievalTokens: 1200,
          scoreThreshold: 0,
          allowedUserIds: [],
          allowedWorkspaceIds: ['w1'],
        },
        userId: 'u2',
        workspaceId: 'w2',
      }),
    ).toBe(false)
  })

  test('validateAllowedModelOrThrow rejects unsupported model', () => {
    expect(() => validateAllowedModelOrThrow('custom-model')).toThrow(TRPCError)
    expect(() => validateAllowedModelOrThrow('custom-model')).toThrow(
      'Unsupported model "custom-model"',
    )
  })

  test('validateProviderRuntimeConfigOrThrow requires OPENAI_API_KEY for gpt model', () => {
    expect(() => validateProviderRuntimeConfigOrThrow('gpt-5')).toThrow(TRPCError)
    expect(() => validateProviderRuntimeConfigOrThrow('gpt-5')).toThrow(
      'OPENAI_API_KEY is required for model "gpt-5".',
    )
  })

  test('validateProviderRuntimeConfigOrThrow allows non-gpt model and configured gpt model', () => {
    expect(() => validateProviderRuntimeConfigOrThrow('local-model')).not.toThrow()
    process.env.OPENAI_API_KEY = 'test-key'
    expect(() => validateProviderRuntimeConfigOrThrow('gpt-5')).not.toThrow()
  })
})
