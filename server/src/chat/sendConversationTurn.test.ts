import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  createOrGetConversationPostprocessJobForAuthor,
  createMessageForAuthor,
  createOrGetConversationTurnForAuthor,
  listMessagesForNodeForAuthor,
  updateConversationTurnForAuthor,
} from '../db/index.js'
import { buildConversationContext } from './buildConversationContext.js'
import { selectProvider } from './providers/selectProvider.js'
import { sendConversationTurn } from './sendConversationTurn'
import type { AssistantProvider } from './providers/provider.js'
import { turnEventBroker } from './stream/broker.js'
import type { ChatTurnStreamEvent } from './stream/events.js'

jest.mock('../db/index.js', () => ({
  createOrGetConversationPostprocessJobForAuthor: jest.fn(),
  createMessageForAuthor: jest.fn(),
  createOrGetConversationTurnForAuthor: jest.fn(),
  listMessagesForNodeForAuthor: jest.fn(),
  updateConversationTurnForAuthor: jest.fn(),
}))

jest.mock('./buildConversationContext.js', () => ({
  buildConversationContext: jest.fn(),
}))

jest.mock('./providers/selectProvider.js', () => ({
  selectProvider: jest.fn(),
}))

const createOrGetConversationPostprocessJobForAuthorMock =
  createOrGetConversationPostprocessJobForAuthor as jest.MockedFunction<
    typeof createOrGetConversationPostprocessJobForAuthor
  >
const createMessageForAuthorMock = createMessageForAuthor as jest.MockedFunction<
  typeof createMessageForAuthor
>
const createOrGetConversationTurnForAuthorMock =
  createOrGetConversationTurnForAuthor as jest.MockedFunction<
    typeof createOrGetConversationTurnForAuthor
  >
const listMessagesForNodeForAuthorMock = listMessagesForNodeForAuthor as jest.MockedFunction<
  typeof listMessagesForNodeForAuthor
>
const updateConversationTurnForAuthorMock = updateConversationTurnForAuthor as jest.MockedFunction<
  typeof updateConversationTurnForAuthor
>
const buildConversationContextMock = buildConversationContext as jest.MockedFunction<
  typeof buildConversationContext
>
const selectProviderMock = selectProvider as jest.MockedFunction<typeof selectProvider>

const processingTurn = {
  id: 't1',
  nodeId: 'n1',
  authorUserId: 'u1',
  status: 'processing' as const,
  model: 'gpt-5',
  idempotencyKey: 'idem-1',
  error: null,
  completedAt: null,
  metadata: {},
  createdAt: '2026-03-30T00:00:00.000Z',
  updatedAt: '2026-03-30T00:00:00.000Z',
}

const completedTurn = {
  ...processingTurn,
  status: 'completed' as const,
  completedAt: '2026-03-30T00:00:03.000Z',
  updatedAt: '2026-03-30T00:00:03.000Z',
}

const userMessage = {
  id: 'm-user',
  authorUserId: 'u1',
  nodeId: 'n1',
  turnId: 't1',
  role: 'user' as const,
  content: 'hello',
  metadata: {},
  createdAt: '2026-03-30T00:00:01.000Z',
}

const assistantMessage = {
  id: 'm-assistant',
  authorUserId: 'u1',
  nodeId: 'n1',
  turnId: 't1',
  role: 'assistant' as const,
  content: 'assistant reply',
  metadata: {},
  createdAt: '2026-03-30T00:00:02.000Z',
}

const queuedPostprocessJob = {
  id: 'job-1',
  turnId: 't1',
  jobType: 'summary',
  payload: {},
  status: 'queued' as const,
  attemptCount: 0,
  maxAttempts: 5,
  runAfter: '2026-03-30T00:00:00.000Z',
  lastError: null,
  leasedAt: null,
  leaseOwner: null,
  finishedAt: null,
  createdAt: '2026-03-30T00:00:00.000Z',
  updatedAt: '2026-03-30T00:00:00.000Z',
}

const context = {
  node: {
    id: 'n1',
    title: 'Root',
    summary: 'summary',
    status: 'open' as const,
    confidence: 'medium' as const,
    conclusion: null,
    rationale: null,
    depth: 0,
    parentNodeId: 'n1',
  },
  recentMessages: [
    {
      id: 'm-prev',
      role: 'user' as const,
      content: 'previous',
      createdAt: '2026-03-30T00:00:00.000Z',
    },
  ],
  userInput: 'hello',
}

const makeProvider = (impl: AssistantProvider['generate']): AssistantProvider => ({
  id: 'test-provider',
  generate: impl,
})

describe('sendConversationTurn', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    turnEventBroker.clear()
    process.env.OPENAI_API_KEY = 'test-openai-key'
    delete process.env.CHAT_ALLOWED_MODELS
    createOrGetConversationTurnForAuthorMock.mockResolvedValue({
      turn: processingTurn,
      wasCreated: true,
    })
    createOrGetConversationPostprocessJobForAuthorMock.mockResolvedValue({
      job: queuedPostprocessJob,
      wasCreated: true,
    })
    createMessageForAuthorMock.mockResolvedValue(userMessage)
    buildConversationContextMock.mockResolvedValue(context)
    updateConversationTurnForAuthorMock.mockResolvedValue(completedTurn)
    selectProviderMock.mockReturnValue(
      makeProvider(async (input) => {
        await input.onTokenDelta?.('assistant ')
        await input.onTokenDelta?.('reply')
        return {
          content: assistantMessage.content,
          finishReason: 'stop',
          providerResponseId: 'resp-1',
        }
      }),
    )
  })

  test('creates user+assistant messages and completes turn on success', async () => {
    const emittedEvents: ChatTurnStreamEvent[] = []
    const unsubscribe = turnEventBroker.subscribe({
      turnId: processingTurn.id,
      authorUserId: processingTurn.authorUserId,
      onEvent: (event) => {
        emittedEvents.push(event)
      },
    })

    createMessageForAuthorMock
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantMessage)

    const result = await sendConversationTurn({
      input: {
        nodeId: 'n1',
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idem-1',
      },
      currentUserId: 'u1',
    })
    unsubscribe()

    expect(buildConversationContextMock).toHaveBeenCalledWith({
      nodeId: 'n1',
      currentUserId: 'u1',
      userInput: 'hello',
    })
    expect(selectProviderMock).toHaveBeenCalledWith({ model: 'gpt-5' })
    expect(createMessageForAuthorMock).toHaveBeenNthCalledWith(1, {
      nodeId: 'n1',
      authorUserId: 'u1',
      turnId: 't1',
      role: 'user',
      content: 'hello',
    })
    expect(createMessageForAuthorMock).toHaveBeenNthCalledWith(2, {
      nodeId: 'n1',
      authorUserId: 'u1',
      turnId: 't1',
      role: 'assistant',
      content: 'assistant reply',
    })
    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: 't1',
        status: 'completed',
        error: null,
        completedAt: expect.any(String),
      },
      'u1',
    )
    expect(createOrGetConversationPostprocessJobForAuthorMock).toHaveBeenNthCalledWith(
      1,
      {
        turnId: 't1',
        jobType: 'summary',
        payload: {},
      },
      'u1',
    )
    expect(createOrGetConversationPostprocessJobForAuthorMock).toHaveBeenNthCalledWith(
      2,
      {
        turnId: 't1',
        jobType: 'index',
        payload: {},
      },
      'u1',
    )
    expect(result).toEqual({
      turnId: 't1',
      status: 'completed',
      userMessage,
      assistantMessage,
      error: null,
    })

    expect(emittedEvents.map((event) => event.type)).toEqual([
      'turn.started',
      'turn.status',
      'turn.status',
      'token.delta',
      'token.delta',
      'turn.status',
      'message.completed',
    ])
    expect(emittedEvents.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(
      emittedEvents
        .filter((event) => event.type === 'token.delta')
        .map((event) => event.payload.delta)
        .join(''),
    ).toBe('assistant reply')
  })

  test('duplicate idempotency replay does not regenerate and recovers existing messages', async () => {
    const emittedEvents: ChatTurnStreamEvent[] = []
    const unsubscribe = turnEventBroker.subscribe({
      turnId: processingTurn.id,
      authorUserId: processingTurn.authorUserId,
      onEvent: (event) => {
        emittedEvents.push(event)
      },
    })

    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: {
        ...completedTurn,
        createdAt: '2026-03-30T00:00:00.000Z',
      },
      wasCreated: false,
    })
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      userMessage,
      assistantMessage,
    ])

    const result = await sendConversationTurn({
      input: {
        nodeId: 'n1',
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idem-1',
      },
      currentUserId: 'u1',
    })
    unsubscribe()

    expect(buildConversationContextMock).not.toHaveBeenCalled()
    expect(selectProviderMock).not.toHaveBeenCalled()
    expect(createMessageForAuthorMock).not.toHaveBeenCalled()
    expect(updateConversationTurnForAuthorMock).not.toHaveBeenCalled()
    expect(createOrGetConversationPostprocessJobForAuthorMock).toHaveBeenCalledTimes(2)
    expect(emittedEvents).toEqual([])
    expect(result).toEqual({
      turnId: 't1',
      status: 'completed',
      userMessage,
      assistantMessage,
      error: null,
    })
  })

  test('duplicate idempotency replay without recoverable user message returns CONFLICT', async () => {
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: completedTurn,
      wasCreated: false,
    })
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      {
        ...userMessage,
        content: 'different',
      },
    ])

    await expect(
      sendConversationTurn({
        input: {
          nodeId: 'n1',
          text: 'hello',
          model: 'gpt-5',
          idempotencyKey: 'idem-1',
        },
        currentUserId: 'u1',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A turn already exists for this idempotency key.',
    })
  })

  test('provider failure marks turn failed and returns INTERNAL_SERVER_ERROR', async () => {
    const emittedEvents: ChatTurnStreamEvent[] = []
    const unsubscribe = turnEventBroker.subscribe({
      turnId: processingTurn.id,
      authorUserId: processingTurn.authorUserId,
      onEvent: (event) => {
        emittedEvents.push(event)
      },
    })

    createMessageForAuthorMock.mockResolvedValueOnce(userMessage)
    selectProviderMock.mockReturnValueOnce(
      makeProvider(async () => {
        throw new Error('provider boom')
      }),
    )

    await expect(
      sendConversationTurn({
        input: {
          nodeId: 'n1',
          text: 'hello',
          model: 'gpt-5',
          idempotencyKey: 'idem-1',
        },
        currentUserId: 'u1',
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Assistant generation failed.',
    })
    unsubscribe()

    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: 't1',
        status: 'failed',
        error: 'provider boom',
      },
      'u1',
    )
    expect(emittedEvents[emittedEvents.length - 1]).toMatchObject({
      type: 'turn.error',
      payload: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Assistant generation failed.',
      },
    })
    expect(createOrGetConversationPostprocessJobForAuthorMock).not.toHaveBeenCalled()
  })

  test('assistant insert race marks turn failed and returns NOT_FOUND', async () => {
    const emittedEvents: ChatTurnStreamEvent[] = []
    const unsubscribe = turnEventBroker.subscribe({
      turnId: processingTurn.id,
      authorUserId: processingTurn.authorUserId,
      onEvent: (event) => {
        emittedEvents.push(event)
      },
    })

    createMessageForAuthorMock
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(null)

    await expect(
      sendConversationTurn({
        input: {
          nodeId: 'n1',
          text: 'hello',
          model: 'gpt-5',
          idempotencyKey: 'idem-1',
        },
        currentUserId: 'u1',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
    unsubscribe()

    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: 't1',
        status: 'failed',
        error: 'Node not found.',
      },
      'u1',
    )
    expect(emittedEvents[emittedEvents.length - 1]).toMatchObject({
      type: 'turn.error',
      payload: {
        code: 'NOT_FOUND',
        message: 'Node not found.',
      },
    })
    expect(emittedEvents.some((event) => event.type === 'message.completed')).toBe(false)
  })

  test('rejects unsupported model before creating a turn', async () => {
    process.env.CHAT_ALLOWED_MODELS = 'gpt-5'

    await expect(
      sendConversationTurn({
        input: {
          nodeId: 'n1',
          text: 'hello',
          model: 'gpt-4o',
          idempotencyKey: 'idem-1',
        },
        currentUserId: 'u1',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Unsupported model "gpt-4o". Allowed models: gpt-5',
    })

    expect(createOrGetConversationTurnForAuthorMock).not.toHaveBeenCalled()
  })

  test('rejects gpt model when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(
      sendConversationTurn({
        input: {
          nodeId: 'n1',
          text: 'hello',
          model: 'gpt-5',
          idempotencyKey: 'idem-1',
        },
        currentUserId: 'u1',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'OPENAI_API_KEY is required for model "gpt-5".',
    })

    expect(createOrGetConversationTurnForAuthorMock).not.toHaveBeenCalled()
  })

  test('enqueue postprocess failure is non-fatal to successful turn completion', async () => {
    createMessageForAuthorMock
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantMessage)
    createOrGetConversationPostprocessJobForAuthorMock
      .mockRejectedValueOnce(new Error('enqueue boom'))
      .mockResolvedValueOnce({
        job: {
          ...queuedPostprocessJob,
          id: 'job-2',
          jobType: 'index',
        },
        wasCreated: true,
      })
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await sendConversationTurn({
      input: {
        nodeId: 'n1',
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idem-1',
      },
      currentUserId: 'u1',
    })

    expect(result.status).toBe('completed')
    expect(result.assistantMessage?.id).toBe('m-assistant')
    expect(createOrGetConversationPostprocessJobForAuthorMock).toHaveBeenCalledTimes(2)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[postprocess] enqueue failed but response path remains successful.',
      expect.objectContaining({
        turnId: 't1',
        jobType: 'summary',
        currentUserId: 'u1',
      }),
    )
  })
})
