import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  generateAssistantReplyForTurn,
  type TurnGenerationRuntime,
} from './generateAssistantReplyForTurn.js'
import { selectProvider } from './providers/selectProvider.js'
import type { AssistantProvider } from './providers/provider.js'
import type { RetrievalStageState } from './turnContextPipeline.js'
import type { TurnEventPublisher } from './turnEventPublisher.js'

jest.mock('./providers/selectProvider.js', () => ({
  selectProvider: jest.fn(),
}))

const selectProviderMock = selectProvider as jest.MockedFunction<typeof selectProvider>

const baseRuntime: Omit<TurnGenerationRuntime, 'publishTurnEvent'> = {
  input: {
    nodeId: 'n1',
    text: 'hello',
    model: 'gpt-5',
    idempotencyKey: 'idem-1',
  },
  currentUserId: 'u1',
  turn: {
    id: 't1',
    nodeId: 'n1',
    authorUserId: 'u1',
    status: 'processing',
    model: 'gpt-5',
    idempotencyKey: 'idem-1',
    error: null,
    completedAt: null,
    metadata: {},
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  },
}

const retrievalState: RetrievalStageState = {
  prompt: {
    instructions: ['Node title: Root'],
    conversation: [],
    currentUserMessage: 'hello',
    retrievalContext: [],
  },
  promptBudgetSummary: {
    instructionCount: 1,
    conversationCountBefore: 0,
    conversationCountAfter: 0,
    retrievalCountBefore: 0,
    retrievalCountAfter: 0,
    trimmedConversationCount: 0,
    trimmedRetrievalCount: 0,
    estimatedTokensBefore: 10,
    estimatedTokensAfter: 10,
  },
}

const makeProvider = (impl: AssistantProvider['generate']): AssistantProvider => ({
  id: 'test-provider',
  generate: impl,
})

describe('generateAssistantReplyForTurn', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('streams awaiting/generating statuses and token deltas while generating output', async () => {
    const publishedEvents: Parameters<TurnEventPublisher>[0][] = []
    const publishTurnEvent: TurnEventPublisher = async (event) => {
      publishedEvents.push(event)
    }
    const runtime: TurnGenerationRuntime = {
      ...baseRuntime,
      publishTurnEvent,
    }

    selectProviderMock.mockReturnValueOnce(
      makeProvider(async (input) => {
        await input.onTokenDelta?.('assistant ')
        await input.onTokenDelta?.('reply')
        return {
          content: 'assistant reply',
          finishReason: 'stop',
          providerResponseId: 'resp-1',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        }
      }),
    )

    const result = await generateAssistantReplyForTurn({
      runtime,
      retrievalState,
    })

    expect(selectProviderMock).toHaveBeenCalledWith({ model: 'gpt-5' })
    expect(result).toEqual({
      content: 'assistant reply',
      finishReason: 'stop',
      providerResponseId: 'resp-1',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    })
    expect(publishedEvents).toEqual([
      {
        type: 'turn.status',
        payload: {
          status: 'awaiting_model',
          detail: 'Waiting for model service.',
        },
      },
      {
        type: 'turn.status',
        payload: {
          status: 'generating',
          detail: 'Generating assistant response.',
        },
      },
      {
        type: 'token.delta',
        payload: {
          delta: 'assistant ',
        },
      },
      {
        type: 'token.delta',
        payload: {
          delta: 'reply',
        },
      },
    ])
  })

  test('publishes generating status only once even with multiple token deltas', async () => {
    const publishedEvents: Parameters<TurnEventPublisher>[0][] = []
    const runtime: TurnGenerationRuntime = {
      ...baseRuntime,
      publishTurnEvent: async (event) => {
        publishedEvents.push(event)
      },
    }

    selectProviderMock.mockReturnValueOnce(
      makeProvider(async (input) => {
        await input.onTokenDelta?.('a')
        await input.onTokenDelta?.('b')
        await input.onTokenDelta?.('c')
        return {
          content: 'abc',
          finishReason: 'stop',
          providerResponseId: 'resp-2',
          usage: { inputTokens: null, outputTokens: null, totalTokens: null },
        }
      }),
    )

    await generateAssistantReplyForTurn({
      runtime,
      retrievalState,
    })

    expect(
      publishedEvents.filter((event) => {
        if (event.type !== 'turn.status') {
          return false
        }
        if (!('status' in event.payload)) {
          return false
        }
        return event.payload.status === 'generating'
      }),
    ).toHaveLength(1)
  })

  test('skips empty token deltas and avoids generating status when nothing is streamed', async () => {
    const publishedEvents: Parameters<TurnEventPublisher>[0][] = []
    const runtime: TurnGenerationRuntime = {
      ...baseRuntime,
      publishTurnEvent: async (event) => {
        publishedEvents.push(event)
      },
    }

    selectProviderMock.mockReturnValueOnce(
      makeProvider(async (input) => {
        await input.onTokenDelta?.('')
        return {
          content: 'assistant reply',
          finishReason: 'stop',
          providerResponseId: 'resp-3',
          usage: { inputTokens: null, outputTokens: null, totalTokens: null },
        }
      }),
    )

    await generateAssistantReplyForTurn({
      runtime,
      retrievalState,
    })

    expect(publishedEvents).toEqual([
      {
        type: 'turn.status',
        payload: {
          status: 'awaiting_model',
          detail: 'Waiting for model service.',
        },
      },
    ])
  })

  test('bubbles provider errors after emitting awaiting_model status', async () => {
    const publishedEvents: Parameters<TurnEventPublisher>[0][] = []
    const runtime: TurnGenerationRuntime = {
      ...baseRuntime,
      publishTurnEvent: async (event) => {
        publishedEvents.push(event)
      },
    }

    selectProviderMock.mockReturnValueOnce(
      makeProvider(async () => {
        throw new Error('provider boom')
      }),
    )

    await expect(
      generateAssistantReplyForTurn({
        runtime,
        retrievalState,
      }),
    ).rejects.toThrow('provider boom')

    expect(publishedEvents).toEqual([
      {
        type: 'turn.status',
        payload: {
          status: 'awaiting_model',
          detail: 'Waiting for model service.',
        },
      },
    ])
  })
})
