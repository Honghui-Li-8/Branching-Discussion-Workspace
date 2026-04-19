import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  getMessageBranchSourceContextForAuthor,
  createMessageForAuthor,
} from '../db/queries/message.js'
import { updateConversationTurnForAuthor } from '../db/index.js'
import { runConversationTurnFlow } from '../chat/runConversationTurnFlow.js'
import { resolveConversationTurnOrThrow } from '../chat/resolveConversationTurnOrThrow.js'
import { branchMessageFromSelectionInTransaction } from './branchMessageFromSelection.js'
import {
  branchAndSendFollowup,
  MessageBranchSelectionInvalidInputError,
  MessageBranchSelectionConflictError,
} from './branchAndSendFollowup.js'

jest.mock('../db/queries/message.js', () => ({
  getMessageBranchSourceContextForAuthor: jest.fn(),
  createMessageForAuthor: jest.fn(),
}))
jest.mock('../db/index.js', () => ({
  updateConversationTurnForAuthor: jest.fn(),
}))
jest.mock('../chat/runConversationTurnFlow.js', () => ({
  runConversationTurnFlow: jest.fn(),
}))
jest.mock('../chat/resolveConversationTurnOrThrow.js', () => ({
  resolveConversationTurnOrThrow: jest.fn(),
}))
jest.mock('./branchMessageFromSelection.js', () => ({
  branchMessageFromSelectionInTransaction: jest.fn(),
  MessageBranchSelectionInvalidInputError: class MessageBranchSelectionInvalidInputError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'MessageBranchSelectionInvalidInputError'
    }
  },
  MessageBranchSelectionConflictError: class MessageBranchSelectionConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'MessageBranchSelectionConflictError'
    }
  },
}))

const getSourceContextMock = getMessageBranchSourceContextForAuthor as jest.MockedFunction<
  typeof getMessageBranchSourceContextForAuthor
>
const createMessageForAuthorMock = createMessageForAuthor as jest.MockedFunction<
  typeof createMessageForAuthor
>
const runTurnFlowMock = runConversationTurnFlow as jest.MockedFunction<
  typeof runConversationTurnFlow
>
const updateConversationTurnForAuthorMock = updateConversationTurnForAuthor as jest.MockedFunction<
  typeof updateConversationTurnForAuthor
>
const resolveConversationTurnOrThrowMock = resolveConversationTurnOrThrow as jest.MockedFunction<
  typeof resolveConversationTurnOrThrow
>
const branchInTransactionMock = branchMessageFromSelectionInTransaction as jest.MockedFunction<
  typeof branchMessageFromSelectionInTransaction
>

const fixedNow = '2026-04-04T00:00:00.000Z'

const buildInput = () => ({
  messageId: 'm1',
  selection: {
    quote: 'hello world',
    selectorJson: { selector: [{ quote: 'hello world', start: 0, end: 11 }] },
    startOffset: 0 as const,
    endOffset: 11 as const,
  },
  sourceContext: 'some surrounding context text',
  text: 'What do you mean by this?',
  model: 'claude-sonnet-4-6',
  idempotencyKey: 'idem-1',
})

const sourceContextRecord = {
  messageId: 'm1',
  parentNodeId: 'n-parent',
  workspaceId: 'w1',
}

const branchResult = {
  annotation: {
    id: 'a1',
    messageId: 'm1',
    leadsToNodeId: 'n-branch',
    kind: 'branch' as const,
    quote: 'hello world',
    startOffset: 0,
    endOffset: 11,
    selectorJson: { selector: [{ quote: 'hello world', start: 0, end: 11 }] },
    createdByUserId: 'u1',
    createdAt: fixedNow,
    updatedAt: fixedNow,
    deletedAt: null,
  },
  branchNodeId: 'n-branch',
}

const branchEventMessageRecord = {
  id: 'event-msg-1',
  nodeId: 'n-branch',
  authorUserId: 'u1',
  turnId: null,
  role: 'user' as const,
  content: 'some surrounding context text',
  metadata: {
    eventType: 'branch_event' as const,
    sourceNodeId: 'n-parent',
    sourceMessageId: 'm1',
    sourceAnnotationId: 'a1',
    sourceContext: 'some surrounding context text',
    branchNodeId: 'n-branch',
  },
  createdAt: fixedNow,
}

const turnResult = {
  turnId: 't1',
  status: 'processing' as const,
  userMessage: {
    id: 'user-msg-1',
    nodeId: 'n-branch',
    authorUserId: 'u1',
    turnId: 't1',
    role: 'user' as const,
    content: 'What do you mean by this?',
    metadata: {},
    createdAt: fixedNow,
  },
  assistantMessage: null,
  error: null,
}

const resolvedTurn = {
  turn: {
    id: 't1',
    nodeId: 'n-branch',
    authorUserId: 'u1',
    status: 'processing' as const,
    model: 'claude-sonnet-4-6',
    idempotencyKey: 'idem-1:turn',
    error: null,
    completedAt: null,
    metadata: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  wasCreated: true,
}

const flushPromises = () => new Promise<void>((resolve) => {
  setImmediate(() => resolve())
})

describe('branchAndSendFollowup', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('returns null when source message context is not found', async () => {
    getSourceContextMock.mockResolvedValueOnce(null)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(result).toBeNull()
    expect(branchInTransactionMock).not.toHaveBeenCalled()
    expect(createMessageForAuthorMock).not.toHaveBeenCalled()
    expect(runTurnFlowMock).not.toHaveBeenCalled()
  })

  test('returns null when branch transaction returns null', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(null)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(result).toBeNull()
    expect(createMessageForAuthorMock).not.toHaveBeenCalled()
    expect(runTurnFlowMock).not.toHaveBeenCalled()
  })

  test('returns combined result on full success path', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    resolveConversationTurnOrThrowMock.mockResolvedValueOnce(resolvedTurn as never)
    createMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })
    await flushPromises()

    expect(result).toEqual({
      branchNodeId: 'n-branch',
      annotationId: 'a1',
      branchEventMessageId: null,
      userFollowupMessageId: null,
      turnId: 't1',
      status: 'processing',
    })
  })

  test('uses sourceContext as branch event message content', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    resolveConversationTurnOrThrowMock.mockResolvedValueOnce(resolvedTurn as never)
    createMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })
    await flushPromises()

    expect(createMessageForAuthorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'some surrounding context text',
        role: 'user',
        metadata: expect.objectContaining({ eventType: 'branch_event' }),
      }),
    )
  })

  test('passes branch event message metadata with correct provenance fields', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    resolveConversationTurnOrThrowMock.mockResolvedValueOnce(resolvedTurn as never)
    createMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })
    await flushPromises()

    expect(createMessageForAuthorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'n-branch',
        metadata: expect.objectContaining({
          eventType: 'branch_event',
          sourceNodeId: 'n-parent',
          sourceMessageId: 'm1',
          sourceAnnotationId: 'a1',
          branchNodeId: 'n-branch',
        }),
      }),
    )
  })

  test('triggers turn pipeline with derived :turn idempotency key and follow-up text', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    resolveConversationTurnOrThrowMock.mockResolvedValueOnce(resolvedTurn as never)
    createMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })
    await flushPromises()

    expect(runTurnFlowMock).toHaveBeenCalledWith({
      input: expect.objectContaining({
        nodeId: 'n-branch',
        text: 'What do you mean by this?',
        model: 'claude-sonnet-4-6',
        idempotencyKey: 'idem-1:turn',
      }),
      currentUserId: 'u1',
      awaitCompletion: false,
    })
  })

  test('passes :branch sub-key to branch transaction', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    resolveConversationTurnOrThrowMock.mockResolvedValueOnce(resolvedTurn as never)
    createMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(branchInTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ idempotencyKey: 'idem-1:branch' }),
        currentUserId: 'u1',
      }),
    )
  })

  test('marks the turn failed when branch event message creation returns null', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    resolveConversationTurnOrThrowMock.mockResolvedValueOnce(resolvedTurn as never)
    createMessageForAuthorMock.mockResolvedValueOnce(null)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })
    await flushPromises()

    expect(result).toMatchObject({ turnId: 't1', status: 'processing' })
    expect(runTurnFlowMock).not.toHaveBeenCalled()
    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't1',
        status: 'failed',
        error: 'Failed to create branch event message in child node.',
      }),
      'u1',
    )
  })

  test('returns before awaiting background turn startup', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    resolveConversationTurnOrThrowMock.mockResolvedValueOnce(resolvedTurn as never)
    createMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockImplementationOnce(
      () => new Promise(() => undefined) as never,
    )

    await expect(
      branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' }),
    ).resolves.toMatchObject({ turnId: 't1', status: 'processing' })
  })

  test('forwards suggestion-branch provenance to branch transaction', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    resolveConversationTurnOrThrowMock.mockResolvedValueOnce(resolvedTurn as never)
    createMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({
      input: {
        ...buildInput(),
        annotationKind: 'suggestion-branch',
        sourceAnnotationId: 'a-suggest-1',
      },
      currentUserId: 'u1',
    })
    await flushPromises()

    expect(branchInTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          annotationKind: 'suggestion-branch',
          sourceAnnotationId: 'a-suggest-1',
        }),
      }),
    )
  })

  test('propagates MessageBranchSelectionInvalidInputError from branch transaction', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockRejectedValueOnce(
      new MessageBranchSelectionInvalidInputError('unexpected invalid input.'),
    )

    await expect(
      branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' }),
    ).rejects.toThrow(MessageBranchSelectionInvalidInputError)
  })

  test('propagates MessageBranchSelectionConflictError from branch transaction', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockRejectedValueOnce(
      new MessageBranchSelectionConflictError('Existing record is incomplete.'),
    )

    await expect(
      branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' }),
    ).rejects.toThrow(MessageBranchSelectionConflictError)
  })
})
