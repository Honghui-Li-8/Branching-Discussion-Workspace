import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { STRUCTURAL_MESSAGE_TYPES } from '@branching/shared'
import {
  getMessageBranchSourceContextForAuthor,
  createOrGetBranchEventMessageForAuthor,
  getBranchEventMetadataFromRecord,
  listMessagesByTurn,
} from '../db/queries/message.js'
import { getConversationTurnByIdempotencyKeyForAuthor } from '../db/index.js'
import { runConversationTurnFlow } from '../chat/runConversationTurnFlow.js'
import { TRPCError } from '@trpc/server'
import { branchMessageFromSelectionInTransaction } from './branchMessageFromSelection.js'
import {
  branchAndSendFollowup,
  MessageBranchSelectionInvalidInputError,
  MessageBranchSelectionConflictError,
} from './branchAndSendFollowup.js'

jest.mock('../db/queries/message.js', () => ({
  getMessageBranchSourceContextForAuthor: jest.fn(),
  createOrGetBranchEventMessageForAuthor: jest.fn(),
  listMessagesByTurn: jest.fn(),
  getBranchEventMetadataFromRecord: jest.fn((record: { metadata: { eventType?: string } }) =>
    record.metadata?.eventType === STRUCTURAL_MESSAGE_TYPES.branchEvent ? record.metadata : null,
  ),
}))
jest.mock('../db/index.js', () => ({
  getConversationTurnByIdempotencyKeyForAuthor: jest.fn(),
}))
jest.mock('../chat/runConversationTurnFlow.js', () => ({
  runConversationTurnFlow: jest.fn(),
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
const createOrGetBranchEventMessageForAuthorMock =
  createOrGetBranchEventMessageForAuthor as jest.MockedFunction<
    typeof createOrGetBranchEventMessageForAuthor
  >
const listMessagesByTurnMock = listMessagesByTurn as jest.MockedFunction<
  typeof listMessagesByTurn
>
const getBranchEventMetadataFromRecordMock = getBranchEventMetadataFromRecord as jest.MockedFunction<
  typeof getBranchEventMetadataFromRecord
>
const runTurnFlowMock = runConversationTurnFlow as jest.MockedFunction<
  typeof runConversationTurnFlow
>
const getConversationTurnByIdempotencyKeyForAuthorMock =
  getConversationTurnByIdempotencyKeyForAuthor as jest.MockedFunction<
    typeof getConversationTurnByIdempotencyKeyForAuthor
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
  content: 'hello world',
  metadata: {
    eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
    sourceNodeId: 'n-parent',
    sourceMessageId: 'm1',
    sourceAnnotationId: 'a1',
    sourceContext: 'hello world',
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

describe('branchAndSendFollowup', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    getBranchEventMetadataFromRecordMock.mockImplementation(
      (record) =>
        record.metadata?.eventType === STRUCTURAL_MESSAGE_TYPES.branchEvent ? (record.metadata as never) : null,
    )
  })

  test('returns null when source message context is not found', async () => {
    getSourceContextMock.mockResolvedValueOnce(null)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(result).toBeNull()
    expect(branchInTransactionMock).not.toHaveBeenCalled()
    expect(createOrGetBranchEventMessageForAuthorMock).not.toHaveBeenCalled()
    expect(runTurnFlowMock).not.toHaveBeenCalled()
  })

  test('returns null when branch transaction returns null', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(null)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(result).toBeNull()
    expect(createOrGetBranchEventMessageForAuthorMock).not.toHaveBeenCalled()
    expect(runTurnFlowMock).not.toHaveBeenCalled()
  })

  test('returns combined result on full success path', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(result).toEqual({
      branchNodeId: 'n-branch',
      annotationId: 'a1',
      branchEventMessageId: 'event-msg-1',
      userFollowupMessageId: 'user-msg-1',
      turnId: 't1',
      status: 'processing',
    })
  })

  test('uses sourceContext as branch event message content', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(createOrGetBranchEventMessageForAuthorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'hello world',
        metadata: expect.objectContaining({ eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent }),
      }),
    )
  })

  test('passes branch event message metadata with correct provenance fields', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(createOrGetBranchEventMessageForAuthorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'n-branch',
        metadata: expect.objectContaining({
          eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
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
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

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
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(branchInTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ idempotencyKey: 'idem-1:branch' }),
        currentUserId: 'u1',
      }),
    )
  })

  test('throws when branch event message creation returns null', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(null)

    await expect(
      branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' }),
    ).rejects.toThrow('Failed to create branch event message in child node.')
    expect(runTurnFlowMock).not.toHaveBeenCalled()
  })

  test('awaits turn startup through user message persistence and returns ids', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await expect(branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })).resolves.toMatchObject({
      branchEventMessageId: 'event-msg-1',
      userFollowupMessageId: 'user-msg-1',
      turnId: 't1',
      status: 'processing',
    })
  })

  test('forwards suggestion-branch provenance to branch transaction', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({
      input: {
        ...buildInput(),
        annotationKind: 'suggestion-branch',
        sourceAnnotationId: 'a-suggest-1',
      },
      currentUserId: 'u1',
    })

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

  test('recovers existing turn result when turn startup hits idempotent replay conflict', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockRejectedValueOnce(
      new TRPCError({
        code: 'CONFLICT',
        message: 'A turn already exists for this idempotency key.',
      }),
    )
    getConversationTurnByIdempotencyKeyForAuthorMock.mockResolvedValueOnce({
      id: 't1',
      nodeId: 'n-branch',
      authorUserId: 'u1',
      status: 'processing',
      model: 'claude-sonnet-4-6',
      idempotencyKey: 'idem-1:turn',
      error: null,
      completedAt: null,
      metadata: {},
      createdAt: fixedNow,
      updatedAt: fixedNow,
    })
    listMessagesByTurnMock.mockResolvedValueOnce([turnResult.userMessage])

    await expect(
      branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' }),
    ).resolves.toEqual({
      branchNodeId: 'n-branch',
      annotationId: 'a1',
      branchEventMessageId: 'event-msg-1',
      userFollowupMessageId: 'user-msg-1',
      turnId: 't1',
      status: 'processing',
    })
  })

  test('recovers existing turn result with null follow-up id when replay race resolves before user insert', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockRejectedValueOnce(
      new TRPCError({
        code: 'CONFLICT',
        message: 'A turn already exists for this idempotency key.',
      }),
    )
    getConversationTurnByIdempotencyKeyForAuthorMock.mockResolvedValueOnce({
      id: 't1',
      nodeId: 'n-branch',
      authorUserId: 'u1',
      status: 'processing',
      model: 'claude-sonnet-4-6',
      idempotencyKey: 'idem-1:turn',
      error: null,
      completedAt: null,
      metadata: {},
      createdAt: fixedNow,
      updatedAt: fixedNow,
    })
    listMessagesByTurnMock.mockResolvedValueOnce([])

    await expect(
      branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' }),
    ).resolves.toEqual({
      branchNodeId: 'n-branch',
      annotationId: 'a1',
      branchEventMessageId: 'event-msg-1',
      userFollowupMessageId: null,
      turnId: 't1',
      status: 'processing',
    })
  })
})

describe('branchAndSendFollowup — idempotency and partial-write recovery', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    getBranchEventMetadataFromRecordMock.mockImplementation(
      (record) =>
        record.metadata?.eventType === STRUCTURAL_MESSAGE_TYPES.branchEvent ? (record.metadata as never) : null,
    )
  })

  const existingTurnRecord = {
    id: 't1',
    nodeId: 'n-branch',
    authorUserId: 'u1',
    status: 'processing' as const,
    model: 'claude-sonnet-4-6',
    idempotencyKey: 'idem-1:turn',
    error: null,
    completedAt: null,
    metadata: {},
    createdAt: fixedNow,
    updatedAt: fixedNow,
  }

  test('full same-key retry: branch and event idempotent, turn CONFLICT recovered, returns stable ids', async () => {
    // Simulates a full retry where every idempotency tier fires:
    // branchInTransaction returns existing result (idempotent via :branch key),
    // createOrGetBranchEventMessageForAuthor upserts and returns existing event row,
    // runConversationTurnFlow throws CONFLICT (turn already exists via :turn key),
    // recovery lookup finds existing turn + user message.
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockRejectedValueOnce(
      new TRPCError({ code: 'CONFLICT', message: 'A turn already exists for this idempotency key.' }),
    )
    getConversationTurnByIdempotencyKeyForAuthorMock.mockResolvedValueOnce(existingTurnRecord)
    listMessagesByTurnMock.mockResolvedValueOnce([turnResult.userMessage])

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(result).toEqual({
      branchNodeId: 'n-branch',
      annotationId: 'a1',
      branchEventMessageId: 'event-msg-1',
      userFollowupMessageId: 'user-msg-1',
      turnId: 't1',
      status: 'processing',
    })
    // Verify sub-key routing so each tier's idempotency guard targets the right key.
    expect(branchInTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ idempotencyKey: 'idem-1:branch' }),
      }),
    )
    expect(runTurnFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ idempotencyKey: 'idem-1:turn' }),
      }),
    )
    expect(getConversationTurnByIdempotencyKeyForAuthorMock).toHaveBeenCalledWith(
      'n-branch',
      'u1',
      'idem-1:turn',
    )
  })

  test('retry after branch event already persisted: event upserted, turn fires fresh, recovery not invoked', async () => {
    // Simulates a retry where the first attempt persisted the branch event but did not
    // reach the turn step. The event upsert (ON CONFLICT DO UPDATE) returns the same
    // existing row; the turn pipeline succeeds fresh — no CONFLICT, no recovery lookup.
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    // createOrGetBranchEventMessageForAuthor returns the existing event row via upsert.
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    // Turn fires fresh this time — no CONFLICT.
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(result).toMatchObject({
      branchEventMessageId: 'event-msg-1',
      userFollowupMessageId: 'user-msg-1',
      turnId: 't1',
    })
    expect(getConversationTurnByIdempotencyKeyForAuthorMock).not.toHaveBeenCalled()
    expect(listMessagesByTurnMock).not.toHaveBeenCalled()
  })

  test('different idempotency key creates an independent branch with its own turn and messages', async () => {
    const altBranchResult = {
      annotation: {
        ...branchResult.annotation,
        id: 'a2',
        leadsToNodeId: 'n-branch-2',
      },
      branchNodeId: 'n-branch-2',
    }
    const altEventMessage = {
      ...branchEventMessageRecord,
      id: 'event-msg-2',
      nodeId: 'n-branch-2',
      metadata: { ...branchEventMessageRecord.metadata, branchNodeId: 'n-branch-2' },
    }
    const altTurnResult = {
      turnId: 't2',
      status: 'processing' as const,
      userMessage: {
        ...turnResult.userMessage,
        id: 'user-msg-2',
        nodeId: 'n-branch-2',
        turnId: 't2',
      },
      assistantMessage: null,
      error: null,
    }

    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(altBranchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(altEventMessage)
    runTurnFlowMock.mockResolvedValueOnce(altTurnResult)

    const result = await branchAndSendFollowup({
      input: { ...buildInput(), idempotencyKey: 'idem-2' },
      currentUserId: 'u1',
    })

    expect(result).toMatchObject({
      branchNodeId: 'n-branch-2',
      annotationId: 'a2',
      branchEventMessageId: 'event-msg-2',
      userFollowupMessageId: 'user-msg-2',
      turnId: 't2',
    })
    // Sub-keys must use the new base key — not the 'idem-1' key from the other fixture.
    expect(branchInTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ idempotencyKey: 'idem-2:branch' }),
      }),
    )
    expect(runTurnFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ idempotencyKey: 'idem-2:turn' }),
      }),
    )
    expect(getConversationTurnByIdempotencyKeyForAuthorMock).not.toHaveBeenCalled()
  })

  test('non-CONFLICT turn error propagates and does not attempt recovery', async () => {
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockRejectedValueOnce(
      new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB connection failure.' }),
    )

    await expect(
      branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' }),
    ).rejects.toThrow('DB connection failure.')

    expect(getConversationTurnByIdempotencyKeyForAuthorMock).not.toHaveBeenCalled()
    expect(listMessagesByTurnMock).not.toHaveBeenCalled()
  })

  test('CONFLICT recovery re-throws original error when existing turn cannot be found', async () => {
    // If the CONFLICT error fires but the idempotency-key lookup returns null, the turn
    // is genuinely unrecoverable — the original CONFLICT error must be re-thrown rather
    // than swallowed or replaced.
    const conflictError = new TRPCError({
      code: 'CONFLICT',
      message: 'A turn already exists for this idempotency key.',
    })

    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockRejectedValueOnce(conflictError)
    getConversationTurnByIdempotencyKeyForAuthorMock.mockResolvedValueOnce(null)

    await expect(
      branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' }),
    ).rejects.toThrow('A turn already exists for this idempotency key.')

    expect(getConversationTurnByIdempotencyKeyForAuthorMock).toHaveBeenCalledTimes(1)
    // listMessagesByTurn must not be reached — there is no turn record to query against.
    expect(listMessagesByTurnMock).not.toHaveBeenCalled()
  })
})

describe('branchAndSendFollowup — first child turn ordering', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    getBranchEventMetadataFromRecordMock.mockImplementation(
      (record) =>
        record.metadata?.eventType === STRUCTURAL_MESSAGE_TYPES.branchEvent ? (record.metadata as never) : null,
    )
  })

  test('branch event creation always precedes turn pipeline launch', async () => {
    // Verify the three-step execution order: branch transaction → event upsert → turn pipeline.
    // If any step were reordered the child node could receive turn messages before its branch
    // event row exists, breaking the ordered message sequence the context builder relies on.
    const callOrder: string[] = []

    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockImplementationOnce(async () => {
      callOrder.push('branch')
      return branchResult
    })
    createOrGetBranchEventMessageForAuthorMock.mockImplementationOnce(async () => {
      callOrder.push('event')
      return branchEventMessageRecord
    })
    runTurnFlowMock.mockImplementationOnce(async () => {
      callOrder.push('turn')
      return turnResult
    })

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(callOrder).toEqual(['branch', 'event', 'turn'])
  })

  test('returned IDs reflect correct persistence roles: branch event has no turnId, follow-up is turn-bound', async () => {
    // The branch event message is persisted with turn_id = null (it predates and outlives any turn).
    // The follow-up user message is turn-bound (turn_id = t1).
    // branchAndSendFollowup must map both IDs correctly so callers can distinguish the two rows.
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    const result = await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    // branchEventMessageId must come from the branch event record (turnId: null in fixture).
    expect(result?.branchEventMessageId).toBe(branchEventMessageRecord.id)
    expect(branchEventMessageRecord.turnId).toBeNull()

    // userFollowupMessageId must come from the turn result's user message (turnId: t1 in fixture).
    expect(result?.userFollowupMessageId).toBe(turnResult.userMessage.id)
    expect(turnResult.userMessage.turnId).toBe(turnResult.turnId)

    // The two IDs must be distinct rows.
    expect(result?.branchEventMessageId).not.toBe(result?.userFollowupMessageId)
  })

  test('branch event metadata encodes parent provenance so context builder can recover parent history', async () => {
    // The branch event message is the sole carrier of parent-node context in the MVP.
    // Its metadata must contain sourceNodeId, sourceMessageId, and sourceContext so that
    // downstream context assembly (buildConversationContext) can present the branch point.
    getSourceContextMock.mockResolvedValueOnce(sourceContextRecord)
    branchInTransactionMock.mockResolvedValueOnce(branchResult)
    createOrGetBranchEventMessageForAuthorMock.mockResolvedValueOnce(branchEventMessageRecord)
    runTurnFlowMock.mockResolvedValueOnce(turnResult)

    await branchAndSendFollowup({ input: buildInput(), currentUserId: 'u1' })

    expect(createOrGetBranchEventMessageForAuthorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: branchResult.branchNodeId,
        // content carries the raw sourceContext text so the event doubles as the
        // inherited-history summary for the child node's context window.
        content: buildInput().selection.quote,
        metadata: expect.objectContaining({
          eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
          sourceNodeId: sourceContextRecord.parentNodeId,
          sourceMessageId: sourceContextRecord.messageId,
          sourceAnnotationId: branchResult.annotation.id,
          branchNodeId: branchResult.branchNodeId,
        }),
      }),
    )
  })
})
