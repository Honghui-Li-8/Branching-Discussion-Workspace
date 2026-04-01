import { describe, expect, jest, test } from '@jest/globals'
import { createOpenAIProvider } from './openaiProvider'

const makeInput = () => ({
  model: 'gpt-5',
  prompt: {
    instructions: [
      'Node title: Root Decision',
      'Node summary: Root summary',
      'Node status: open',
      'Node confidence: medium',
    ],
    conversation: [
      {
        id: 'm1',
        role: 'user' as const,
        content: 'hello',
        createdAt: '2026-03-30T00:00:00.000Z',
      },
    ],
    currentUserMessage: 'new question',
    retrievalContext: [],
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
          instructions: [
            'Node title: Root Decision',
            'Node summary: Root summary',
            'Node status: open',
            'Node confidence: medium',
          ].join('\n'),
          input: [
            {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'hello',
                },
              ],
            },
            {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'new question',
                },
              ],
            },
          ],
        }),
      }),
    )
    expect(result).toEqual({
      content: 'assistant text',
      finishReason: 'stop',
      providerResponseId: 'resp_1',
    })
  })

  test('includes retrieval context as a structured developer message', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'resp_2',
        output_text: 'assistant text',
        finish_reason: 'stop',
      }),
    })) as unknown as typeof fetch

    const provider = createOpenAIProvider({
      apiKey: 'test-key',
      fetchImpl: fetchMock,
    })

    await provider.generate({
      model: 'gpt-5',
      prompt: {
        instructions: ['Node title: Root Decision'],
        conversation: [],
        currentUserMessage: 'new question',
        retrievalContext: [
          {
            messageId: 'm-source',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'retrieved evidence',
          },
        ],
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'gpt-5',
          instructions: 'Node title: Root Decision',
          input: [
            {
              type: 'message',
              role: 'developer',
              content: [
                {
                  type: 'input_text',
                  text: [
                    'Retrieved context:',
                    '[source 1 | message=m-source | chunk=0] retrieved evidence',
                  ].join('\n'),
                },
              ],
            },
            {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'new question',
                },
              ],
            },
          ],
        }),
      }),
    )
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
