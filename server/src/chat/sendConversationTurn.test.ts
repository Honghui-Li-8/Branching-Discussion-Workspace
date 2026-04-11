import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  createOrGetConversationPostprocessJobForAuthor,
  createMessageForAuthor,
  createOrGetConversationTurnForAuthor,
  listMessagesForNodeForAuthor,
  updateConversationTurnForAuthor,
} from '../db/index.js'
import { buildConversationContext } from './buildConversationContext.js'
import { selectProvider } from './providers/selectProvider.js'
import { resolveRetriever } from './rag/retriever.js'
import { ragMetrics } from './rag/telemetry.js'
import { sendConversationTurn } from './sendConversationTurn'
import type { AssistantProvider } from './providers/provider.js'
import { turnEventBroker } from './stream/broker.js'
import type { ChatTurnStreamEvent } from './stream/events.js'
import { appendConversationTurnEvent } from '../db/queries/conversationTurnEvent.js'

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

jest.mock('./rag/retriever.js', () => ({
  resolveRetriever: jest.fn(),
}))

jest.mock('../db/queries/conversationTurnEvent.js', () => ({
  appendConversationTurnEvent: jest.fn(),
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
const resolveRetrieverMock = resolveRetriever as jest.MockedFunction<
  typeof resolveRetriever
>
const appendConversationTurnEventMock = appendConversationTurnEvent as jest.MockedFunction<
  typeof appendConversationTurnEvent
>

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
    workspaceId: 'w1',
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
  memoryPlaceholder: {
    status: 'pending' as const,
    olderMessageCount: 3,
    retainedMessageCount: 1,
  },
}

const makeProvider = (impl: AssistantProvider['generate']): AssistantProvider => ({
  id: 'test-provider',
  generate: impl,
})

describe('sendConversationTurn', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    ragMetrics.reset()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    turnEventBroker.clear()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.OPENAI_API_KEY = 'test-openai-key'
    delete process.env.CHAT_ALLOWED_MODELS
    delete process.env.RAG_ENABLED
    delete process.env.RAG_RETRIEVER
    delete process.env.RAG_ALLOWED_USER_IDS
    delete process.env.RAG_ALLOWED_WORKSPACE_IDS
    let eventId = 100
    appendConversationTurnEventMock.mockImplementation(async (input) => {
      eventId += 1
      return {
        id: eventId,
        turnId: input.turnId,
        seq: input.seq,
        eventType: input.eventType,
        payload: input.payload ?? {},
        createdAt: new Date().toISOString(),
      }
    })
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
    resolveRetrieverMock.mockReturnValue({
      id: 'noop',
      retrieve: jest.fn(async () => ({
        chunks: [],
        diagnostics: {
          retriever: 'noop',
          totalChunks: 0,
          selectedChunks: 0,
          fallbackReason: 'retrieval_disabled',
        },
      })),
    })
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
        prebuiltContext: context,
    })
    unsubscribe()

    expect(buildConversationContextMock).toHaveBeenCalledWith({
      nodeId: 'n1',
      currentUserId: 'u1',
        prebuiltContext: context,
      userInput: 'hello',
      currentTurnId: 't1',
    })
    expect(console.warn).toHaveBeenCalledWith(
      '[chat] older conversation context would use a placeholder summary path.',
      expect.objectContaining({
        turn_id: 't1',
        node_id: 'n1',
        author_user_id: 'u1',
        placeholder_status: 'pending',
        older_message_count: 3,
        retained_message_count: 1,
      }),
    )
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
      'turn.status',
      'token.delta',
      'token.delta',
      'turn.status',
      'message.completed',
    ])
    expect(emittedEvents.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    const emittedTurnStatuses = emittedEvents
      .filter((event) => event.type === 'turn.status')
      .map((event) => event.payload.status)
    expect(emittedTurnStatuses).toEqual([
      'loading_context',
      'awaiting_model',
      'generating',
      'persisting',
    ])
    expect(
      emittedEvents
        .filter((event) => event.type === 'token.delta')
        .map((event) => event.payload.delta)
        .join(''),
    ).toBe('assistant reply')
  })

  test('returns processing immediately when awaitCompletion is false', async () => {
    const releaseProviderRef: { current: () => void } = {
      current: () => {},
    }
    const providerGate = new Promise<void>((resolve) => {
      releaseProviderRef.current = () => {
        resolve()
      }
    })

    selectProviderMock.mockReturnValueOnce(
      makeProvider(async (input) => {
        await input.onTokenDelta?.('assistant ')
        await providerGate
        await input.onTokenDelta?.('reply')
        return {
          content: assistantMessage.content,
          finishReason: 'stop',
          providerResponseId: 'resp-background',
        }
      }),
    )
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
      prebuiltContext: context,
      awaitCompletion: false,
    })

    expect(result).toEqual({
      turnId: 't1',
      status: 'processing',
      userMessage,
      assistantMessage: null,
      error: null,
    })
    expect(createMessageForAuthorMock).toHaveBeenCalledTimes(1)

    releaseProviderRef.current()
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })

    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't1',
        status: 'completed',
      }),
      'u1',
    )
  })

  test('retrieves context, enriches the prompt, and persists citations when RAG is enabled', async () => {
    process.env.RAG_ENABLED = 'true'
    process.env.RAG_RETRIEVER = 'vector_v1'
    process.env.RAG_ALLOWED_WORKSPACE_IDS = 'w1'

    const generatedPrompts: unknown[] = []
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    selectProviderMock.mockReturnValueOnce(
      makeProvider(async (input) => {
        generatedPrompts.push(input.prompt)
        return {
          content: assistantMessage.content,
          finishReason: 'stop',
          providerResponseId: 'resp-rag',
        }
      }),
    )
    resolveRetrieverMock.mockReturnValueOnce({
      id: 'vector_v1',
      retrieve: jest.fn(async () => ({
        chunks: [
          {
            messageId: 'm-source',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'retrieved evidence',
            tokenCount: 12,
            score: 0.91,
          },
        ],
        diagnostics: {
          retriever: 'vector_v1',
          totalChunks: 1,
          selectedChunks: 1,
        },
      })),
    })
    createMessageForAuthorMock
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce({
        ...assistantMessage,
        metadata: {
          citations: [
            {
              messageId: 'm-source',
              nodeId: 'n1',
              chunkIndex: 0,
              excerpt: 'retrieved evidence',
              score: 0.91,
            },
          ],
        },
      })

    const emittedEvents: ChatTurnStreamEvent[] = []
    const unsubscribe = turnEventBroker.subscribe({
      turnId: processingTurn.id,
      authorUserId: processingTurn.authorUserId,
      onEvent: (event) => {
        emittedEvents.push(event)
      },
    })

    const result = await sendConversationTurn({
      input: {
        nodeId: 'n1',
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idem-1',
      },
      currentUserId: 'u1',
      prebuiltContext: context,
    })
    unsubscribe()

    expect(resolveRetrieverMock).toHaveBeenCalledTimes(1)
    expect(generatedPrompts[0]).toMatchObject({
      instructions: [
        'Node title: Root',
        'Node summary: summary',
        'Node status: open',
        'Node confidence: medium',
        `Response format requirements:
- Answer in clean Markdown format.
    - Use short section headers and bold key conclusions when helpful.
    - Use bullet points for collections, and use numbered points when order, priority, or steps matter.
    - For fixed-count or clearly delineated sets, use a numbered top-level list.
    - Avoid long paragraphs. Put thresholds or rules of thumb in a compact list.
    - Wrap code in triple-backtick fenced code blocks and include a language tag when possible.
- Keep responses concise:
    - Start with a high-level response that includes only necessary details.
    - Avoid low-level implementation details unless the user explicitly asks for them or continues with follow-up questions.
    - Avoid long responses on short question`,
      ],
      conversation: [
        {
          id: 'm-prev',
          role: 'user',
          content: 'previous',
          createdAt: '2026-03-30T00:00:00.000Z',
        },
      ],
      currentUserMessage: 'hello',
      retrievalContext: [
        {
          messageId: 'm-source',
          nodeId: 'n1',
          chunkIndex: 0,
          content: 'retrieved evidence',
          tokenCount: 12,
          score: 0.91,
        },
      ],
    })
    expect(createMessageForAuthorMock).toHaveBeenNthCalledWith(2, {
      nodeId: 'n1',
      authorUserId: 'u1',
      turnId: 't1',
      role: 'assistant',
      content: 'assistant reply',
      metadata: {
        citations: [
          {
            messageId: 'm-source',
            nodeId: 'n1',
            chunkIndex: 0,
            excerpt: 'retrieved evidence',
            score: 0.91,
          },
        ],
      },
    })
    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: 't1',
        status: 'completed',
        error: null,
        completedAt: expect.any(String),
        metadata: {
          contextSnapshotId: expect.any(String),
          contextSnapshot: {
            id: expect.any(String),
            chunks: [
              {
                messageId: 'm-source',
                nodeId: 'n1',
                chunkIndex: 0,
                content: 'retrieved evidence',
                tokenCount: 12,
                score: 0.91,
              },
            ],
            totalTokenCount: 12,
            createdAt: expect.any(String),
          },
          retrievalDiagnostics: {
            retriever: 'vector_v1',
            totalChunks: 1,
            selectedChunks: 1,
          },
        },
      },
      'u1',
    )
    const emittedStatuses = emittedEvents.flatMap((event) =>
      'status' in event.payload ? [event.payload.status] : [],
    )
    expect(emittedStatuses).toContain('retrieving')
    expect(ragMetrics.snapshot().counters['rag.retrieval_attempts_total{rag_enabled=true,retriever=vector_v1}']).toBe(1)
    expect(ragMetrics.snapshot().counters['rag.retrieval_hits_total{retriever=vector_v1}']).toBe(1)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[rag] retrieval completed.',
      expect.objectContaining({
        turn_id: 't1',
        node_id: 'n1',
        author_user_id: 'u1',
        retriever: 'vector_v1',
        rag_enabled: true,
      }),
    )
    expect(result.assistantMessage?.metadata).toEqual({
      citations: [
        {
          messageId: 'm-source',
          nodeId: 'n1',
          chunkIndex: 0,
          excerpt: 'retrieved evidence',
          score: 0.91,
        },
      ],
    })
  })

  test('retrieval failure falls back to the base prompt and still completes the turn', async () => {
    process.env.RAG_ENABLED = 'true'
    process.env.RAG_RETRIEVER = 'vector_v1'
    process.env.RAG_ALLOWED_WORKSPACE_IDS = 'w1'

    const generatedPrompts: unknown[] = []
    selectProviderMock.mockReturnValueOnce(
      makeProvider(async (input) => {
        generatedPrompts.push(input.prompt)
        return {
          content: assistantMessage.content,
          finishReason: 'stop',
          providerResponseId: 'resp-fallback',
        }
      }),
    )
    resolveRetrieverMock.mockReturnValueOnce({
      id: 'vector_v1',
      retrieve: jest.fn(async () => {
        throw new Error('retriever boom')
      }),
    })
    createMessageForAuthorMock
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantMessage)
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await sendConversationTurn({
      input: {
        nodeId: 'n1',
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idem-1',
      },
      currentUserId: 'u1',
      prebuiltContext: context,
    })

    expect(generatedPrompts[0]).toMatchObject({
      retrievalContext: [],
      currentUserMessage: 'hello',
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
        metadata: {
          retrievalDiagnostics: {
            retriever: 'vector_v1',
            query: 'hello',
            fallbackReason: 'retrieval_failed',
          },
        },
      },
      'u1',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[rag] Retrieval failed; continuing with base prompt.',
      expect.objectContaining({
        turnId: 't1',
        nodeId: 'n1',
        currentUserId: 'u1',
      prebuiltContext: context,
      }),
    )
    expect(ragMetrics.snapshot().counters['rag.retrieval_fallbacks_total{reason=retrieval_failed,retriever=vector_v1}']).toBe(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[rag] retrieval fell back to base prompt.',
      expect.objectContaining({
        turn_id: 't1',
        node_id: 'n1',
        author_user_id: 'u1',
        retriever: 'vector_v1',
        rag_enabled: true,
        fallback_reason: 'retrieval_failed',
      }),
    )
    expect(result.assistantMessage?.metadata).toEqual({})
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
        prebuiltContext: context,
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
      prebuiltContext: context,
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
      prebuiltContext: context,
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
      prebuiltContext: context,
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
      prebuiltContext: context,
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
      prebuiltContext: context,
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
      prebuiltContext: context,
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
      prebuiltContext: context,
      }),
    )
  })
})
