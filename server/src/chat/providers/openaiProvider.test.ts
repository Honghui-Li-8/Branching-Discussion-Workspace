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
      {
        id: 'm2',
        role: 'assistant' as const,
        content: 'hi, what can I help with?',
        createdAt: '2026-03-30T00:00:01.000Z',
      },
    ],
    currentUserMessage: 'new question',
    retrievalContext: [],
  },
})

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
})

const toSseStream = (frames: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame))
      }
      controller.close()
    },
  })
}

const getRequestBody = (fetchMock: jest.Mock) => {
  const requestInit = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined

  return JSON.parse(String(requestInit?.body ?? '{}')) as {
    model?: string
    instructions?: string
    input?: Array<{
      type?: string
      role?: string
      content?: Array<{
        type?: string
        text?: string
      }>
    }>
  }
}

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
    const logger = makeLogger()

    const provider = createOpenAIProvider({
      apiKey: 'test-key',
      fetchImpl: fetchMock,
      logger,
    })
    const result = await provider.generate(makeInput())

    expect(provider.id).toBe('openai')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(getRequestBody(fetchMock as unknown as jest.Mock)).toEqual({
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
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: 'hi, what can I help with?',
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
    })
    expect(logger.warn).not.toHaveBeenCalled()
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
    const logger = makeLogger()

    const provider = createOpenAIProvider({
      apiKey: 'test-key',
      fetchImpl: fetchMock,
      logger,
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
        method: 'POST',
      }),
    )
    expect(getRequestBody(fetchMock as unknown as jest.Mock)).toEqual({
      model: 'gpt-5',
      instructions: 'Node title: Root Decision',
      input: [
        {
          type: 'message',
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(
                {
                  type: 'temporary_retrieval_context_placeholder',
                  chunkCount: 1,
                  chunks: [
                    {
                      ordinal: 1,
                      messageId: 'm-source',
                      nodeId: 'n1',
                      chunkIndex: 0,
                      tokenCount: null,
                      score: null,
                      content: 'retrieved evidence',
                    },
                  ],
                },
                null,
                2,
              ),
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
    })
    expect(logger.warn).toHaveBeenCalledWith(
      '[llm] OpenAI retrieval context placeholder structure is in use.',
      expect.objectContaining({
        retrieval_context_count: 1,
        retrieval_context_chunk_ordinals: [1],
        retrieval_context_message_ids: ['m-source'],
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

  test('streams output deltas when onTokenDelta callback is provided', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      body: toSseStream([
        'data: {"type":"response.output_text.delta","delta":"hello "}\n\n',
        'data: {"type":"response.output_text.delta","delta":"world"}\n\n',
        'data: {"type":"response.completed","response":{"id":"resp_stream","finish_reason":"stop","output_text":"hello world"}}\n\n',
        'data: [DONE]\n\n',
      ]),
    })) as unknown as typeof fetch
    const logger = makeLogger()
    const onTokenDelta = jest.fn(async (_delta: string) => {})

    const provider = createOpenAIProvider({
      apiKey: 'test-key',
      fetchImpl: fetchMock,
      logger,
    })
    const result = await provider.generate({
      ...makeInput(),
      onTokenDelta,
    })

    expect(getRequestBody(fetchMock as unknown as jest.Mock)).toEqual(
      expect.objectContaining({
        stream: true,
      }),
    )
    expect(onTokenDelta).toHaveBeenNthCalledWith(1, 'hello ')
    expect(onTokenDelta).toHaveBeenNthCalledWith(2, 'world')
    expect(result).toEqual({
      content: 'hello world',
      finishReason: 'stop',
      providerResponseId: 'resp_stream',
    })
  })
})
