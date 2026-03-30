import { describe, expect, jest, test } from '@jest/globals'
import { isOpenAIModel, selectProvider } from './selectProvider'

describe('selectProvider', () => {
  test('isOpenAIModel detects gpt-prefixed models', () => {
    expect(isOpenAIModel('gpt-5')).toBe(true)
    expect(isOpenAIModel(' GPT-4o ')).toBe(true)
    expect(isOpenAIModel('local-model')).toBe(false)
  })

  test('returns placeholder provider for non-openai model', () => {
    const provider = selectProvider({ model: 'local-model' })
    expect(provider.id).toBe('placeholder')
  })

  test('returns placeholder provider when api key is missing', () => {
    const provider = selectProvider({ model: 'gpt-5', apiKey: '' })
    expect(provider.id).toBe('placeholder')
  })

  test('returns openai provider when model and api key are provided', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'resp_1',
        output_text: 'ok',
        finish_reason: 'stop',
      }),
    })) as unknown as typeof fetch

    const provider = selectProvider({
      model: 'gpt-5',
      apiKey: 'key',
      fetchImpl: fetchMock,
    })

    expect(provider.id).toBe('openai')
    await provider.generate({
      model: 'gpt-5',
      context: {
        node: {
          id: 'n1',
          title: 'Root',
          summary: 'summary',
          status: 'open',
          confidence: 'medium',
          conclusion: null,
          rationale: null,
          depth: 0,
          parentNodeId: 'n1',
        },
        recentMessages: [],
        userInput: 'hello',
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
