import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  createMessageForAuthor,
  createOrGetConversationTurnForAuthor,
  listMessagesForNodeForAuthor,
  updateConversationTurnForAuthor,
} from '../db/index.js'
import { buildConversationContext } from './buildConversationContext.js'
import { selectProvider } from './providers/selectProvider.js'
import { sendConversationTurn } from './sendConversationTurn'
import type { AssistantProvider } from './providers/provider.js'

jest.mock('../db/index.js', () => ({
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
  role: 'user' as const,
  content: 'hello',
  createdAt: '2026-03-30T00:00:01.000Z',
}

const assistantMessage = {
  id: 'm-assistant',
  authorUserId: 'u1',
  nodeId: 'n1',
  role: 'assistant' as const,
  content: 'assistant reply',
  createdAt: '2026-03-30T00:00:02.000Z',
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
    createOrGetConversationTurnForAuthorMock.mockResolvedValue({
      turn: processingTurn,
      wasCreated: true,
    })
    createMessageForAuthorMock.mockResolvedValue(userMessage)
    buildConversationContextMock.mockResolvedValue(context)
    updateConversationTurnForAuthorMock.mockResolvedValue(completedTurn)
    selectProviderMock.mockReturnValue(
      makeProvider(async () => ({
        content: assistantMessage.content,
        finishReason: 'stop',
        providerResponseId: 'resp-1',
      })),
    )
  })

  test('creates user+assistant messages and completes turn on success', async () => {
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

    expect(buildConversationContextMock).toHaveBeenCalledWith({
      nodeId: 'n1',
      currentUserId: 'u1',
      userInput: 'hello',
    })
    expect(selectProviderMock).toHaveBeenCalledWith({ model: 'gpt-5' })
    expect(createMessageForAuthorMock).toHaveBeenNthCalledWith(1, {
      nodeId: 'n1',
      authorUserId: 'u1',
      role: 'user',
      content: 'hello',
    })
    expect(createMessageForAuthorMock).toHaveBeenNthCalledWith(2, {
      nodeId: 'n1',
      authorUserId: 'u1',
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
    expect(result).toEqual({
      turnId: 't1',
      status: 'completed',
      userMessage,
      assistantMessage,
      error: null,
    })
  })

  test('duplicate idempotency replay does not regenerate and recovers existing messages', async () => {
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

    expect(buildConversationContextMock).not.toHaveBeenCalled()
    expect(selectProviderMock).not.toHaveBeenCalled()
    expect(createMessageForAuthorMock).not.toHaveBeenCalled()
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

    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: 't1',
        status: 'failed',
        error: 'provider boom',
      },
      'u1',
    )
  })

  test('assistant insert race marks turn failed and returns NOT_FOUND', async () => {
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

    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: 't1',
        status: 'failed',
        error: 'Node not found.',
      },
      'u1',
    )
  })
})
