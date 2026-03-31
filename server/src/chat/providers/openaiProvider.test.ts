import { describe, expect, jest, test } from '@jest/globals'
import { createOpenAIProvider } from './openaiProvider'

const makeInput = () => ({
  model: 'gpt-5',
  prompt: {
    input: 'prebuilt prompt',
    userInput: 'new question',
  },
})

describe('createOpenAIProvider', () => {
  test('throws when api key is missing', () => {
    expect(() => createOpenAIProvider({ apiKey: '' })).toThrow(
      'OPENAI_API_KEY is not configured.',
    )
  })

  test('maps output_text response into assistant result', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'resp_1',
        output_text: 'assistant text',
        finish_reason: 'stop',
      }),
    })) as unknown as typeof fetch

    const provider = createOpenAIProvider({
      apiKey: 'test-key',
      fetchImpl: fetchMock,
    })
    const result = await provider.generate(makeInput())

    expect(provider.id).toBe('openai')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-5',
          input: 'prebuilt prompt',
        }),
      }),
    )
    expect(result).toEqual({
      content: 'assistant text',
      finishReason: 'stop',
      providerResponseId: 'resp_1',
    })
  })

  test('throws on non-ok response', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch

    const provider = createOpenAIProvider({
      apiKey: 'test-key',
      fetchImpl: fetchMock,
    })

    await expect(provider.generate(makeInput())).rejects.toThrow(
      'OpenAI request failed (503).',
    )
  })
})
