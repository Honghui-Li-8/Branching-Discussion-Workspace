import { TRPCError } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import {
  getAllowedChatModels,
  parseAllowedChatModels,
  validateAllowedModelOrThrow,
  validateProviderRuntimeConfigOrThrow,
} from './config'

const originalAllowedModels = process.env.CHAT_ALLOWED_MODELS
const originalOpenAiKey = process.env.OPENAI_API_KEY

describe('chat config guardrails', () => {
  beforeEach(() => {
    delete process.env.CHAT_ALLOWED_MODELS
    delete process.env.OPENAI_API_KEY
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
  })

  test('parseAllowedChatModels normalizes and deduplicates', () => {
    const result = parseAllowedChatModels('GPT-5, gpt-4o, gpt-5,   gpt-4.1 ')
    expect(result).toEqual(['gpt-5', 'gpt-4o', 'gpt-4.1'])
  })

  test('getAllowedChatModels falls back to defaults when env is empty', () => {
    process.env.CHAT_ALLOWED_MODELS = '   '
    expect(getAllowedChatModels()).toEqual(['gpt-5', 'gpt-4o', 'gpt-4.1', 'gpt-4'])
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
