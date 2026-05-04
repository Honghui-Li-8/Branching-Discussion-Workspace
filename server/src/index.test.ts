import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { STRUCTURAL_MESSAGE_TYPES } from '@branching/shared'
import { appRouter } from './router.js'
import { clearAllSessions, createSession } from './auth/sessionStore.js'
import type { SessionUser } from './auth/types.js'
import {
  createOrGetConversationTurnForAuthor,
  createMessageAnnotationForAuthor,
  createMessageForAuthor,
  createNodeForAuthor,
  createWorkspaceForAuthor,
  deleteMessageForAuthor,
  deleteNodeForAuthor,
  deleteWorkspaceForAuthor,
  getBranchEventMetadataFromRecord,
  getMessageAnnotationByIdForAuthor,
  getMessageByIdForAuthor,
  getNodeByIdForAuthor,
  getUserById,
  getWorkspaceByIdForAuthor,
  listMessageAnnotationsByMessageForAuthor,
  listMessagesForNodeForAuthor,
  listParentMessagesUpToSourceForAuthor,
  listNodesByWorkspaceForAuthor,
  listWorkspacesByAuthor,
  softDeleteMessageAnnotationForAuthor,
  transitionMessageAnnotationToSuggestionForAuthor,
  type ConversationTurnRecord,
  updateConversationTurnForAuthor,
  updateMessageForAuthor,
  updateNodeForAuthor,
  updateWorkspaceForAuthor,
} from './db/index.js'
import {
  messageExists,
  nodeExists,
  workspaceExists,
} from './db/queries/internal.js'
import { messageAnnotationExists } from './db/queries/messageAnnotation.js'
import { createAppRouterContext } from './trpcContext.js'
import * as selectProviderModule from './chat/providers/selectProvider.js'
import {
  branchMessageFromSelectionInTransaction,
  MessageBranchSelectionConflictError,
} from './annotations/branchMessageFromSelection.js'

jest.mock('./db/index.js', () => ({
  createOrGetConversationPostprocessJobForAuthor: jest.fn(),
  createOrGetConversationTurnForAuthor: jest.fn(),
  getCreditBalance: jest.fn(async () => 100_000),
  createMessageForAuthor: jest.fn(),
  createMessageAnnotationForAuthor: jest.fn(),
  createNodeForAuthor: jest.fn(),
  createWorkspaceForAuthor: jest.fn(),
  deleteMessageForAuthor: jest.fn(),
  deleteNodeForAuthor: jest.fn(),
  deleteWorkspaceForAuthor: jest.fn(),
  getBranchEventMetadataFromRecord: jest.fn(),
  getMessageAnnotationByIdForAuthor: jest.fn(),
  getMessageByIdForAuthor: jest.fn(),
  getNodeByIdForAuthor: jest.fn(),
  getUserById: jest.fn(),
  getWorkspaceByIdForAuthor: jest.fn(),
  listMessageAnnotationsByMessageForAuthor: jest.fn(),
  listMessagesForNodeForAuthor: jest.fn(),
  listParentMessagesUpToSourceForAuthor: jest.fn(),
  listNodesByWorkspaceForAuthor: jest.fn(),
  listWorkspacesByAuthor: jest.fn(),
  softDeleteMessageAnnotationForAuthor: jest.fn(),
  transitionMessageAnnotationToSuggestionForAuthor: jest.fn(),
  updateConversationTurnForAuthor: jest.fn(),
  updateMessageForAuthor: jest.fn(),
  updateNodeForAuthor: jest.fn(),
  updateWorkspaceForAuthor: jest.fn(),
}))

jest.mock('./db/queries/internal.js', () => ({
  messageExists: jest.fn(),
  nodeExists: jest.fn(),
  workspaceExists: jest.fn(),
}))

jest.mock('./db/queries/message.js', () => ({
  messageExists: (id: string) =>
    (
      jest.requireMock('./db/queries/internal.js') as {
        messageExists: (messageId: string) => Promise<boolean>
      }
    ).messageExists(id),
}))

jest.mock('./db/queries/node.js', () => ({
  nodeExists: (id: string) =>
    (
      jest.requireMock('./db/queries/internal.js') as {
        nodeExists: (nodeId: string) => Promise<boolean>
      }
    ).nodeExists(id),
}))

jest.mock('./db/queries/workspace.js', () => ({
  workspaceExists: (id: string) =>
    (
      jest.requireMock('./db/queries/internal.js') as {
        workspaceExists: (workspaceId: string) => Promise<boolean>
      }
    ).workspaceExists(id),
}))

jest.mock('./db/queries/messageAnnotation.js', () => ({
  messageAnnotationExists: jest.fn(),
}))

jest.mock('./annotations/branchMessageFromSelection.js', () => ({
  branchMessageFromSelectionInTransaction: jest.fn(),
  MessageBranchSelectionConflictError: class MessageBranchSelectionConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'MessageBranchSelectionConflictError'
    }
  },
  MessageBranchSelectionInvalidInputError: class MessageBranchSelectionInvalidInputError
    extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'MessageBranchSelectionInvalidInputError'
    }
  },
}))

const getUserByIdMock = getUserById as jest.MockedFunction<typeof getUserById>
const listWorkspacesByAuthorMock = listWorkspacesByAuthor as jest.MockedFunction<
  typeof listWorkspacesByAuthor
>
const getWorkspaceByIdForAuthorMock = getWorkspaceByIdForAuthor as jest.MockedFunction<
  typeof getWorkspaceByIdForAuthor
>
const getMessageByIdForAuthorMock = getMessageByIdForAuthor as jest.MockedFunction<
  typeof getMessageByIdForAuthor
>
const workspaceExistsMock = workspaceExists as jest.MockedFunction<typeof workspaceExists>
const listNodesByWorkspaceForAuthorMock = listNodesByWorkspaceForAuthor as jest.MockedFunction<
  typeof listNodesByWorkspaceForAuthor
>
const getNodeByIdForAuthorMock = getNodeByIdForAuthor as jest.MockedFunction<
  typeof getNodeByIdForAuthor
>
const nodeExistsMock = nodeExists as jest.MockedFunction<typeof nodeExists>
const listMessagesForNodeForAuthorMock = listMessagesForNodeForAuthor as jest.MockedFunction<
  typeof listMessagesForNodeForAuthor
>
const listParentMessagesUpToSourceForAuthorMock =
  listParentMessagesUpToSourceForAuthor as jest.MockedFunction<
    typeof listParentMessagesUpToSourceForAuthor
  >
const listMessageAnnotationsByMessageForAuthorMock =
  listMessageAnnotationsByMessageForAuthor as jest.MockedFunction<
    typeof listMessageAnnotationsByMessageForAuthor
  >
const getMessageAnnotationByIdForAuthorMock =
  getMessageAnnotationByIdForAuthor as jest.MockedFunction<
    typeof getMessageAnnotationByIdForAuthor
  >
const softDeleteMessageAnnotationForAuthorMock =
  softDeleteMessageAnnotationForAuthor as jest.MockedFunction<
    typeof softDeleteMessageAnnotationForAuthor
  >
const transitionMessageAnnotationToSuggestionForAuthorMock =
  transitionMessageAnnotationToSuggestionForAuthor as jest.MockedFunction<
    typeof transitionMessageAnnotationToSuggestionForAuthor
  >
const messageAnnotationExistsMock =
  messageAnnotationExists as jest.MockedFunction<typeof messageAnnotationExists>
const messageExistsMock = messageExists as jest.MockedFunction<typeof messageExists>
const branchMessageFromSelectionInTransactionMock =
  branchMessageFromSelectionInTransaction as jest.MockedFunction<
    typeof branchMessageFromSelectionInTransaction
  >
const createOrGetConversationTurnForAuthorMock = createOrGetConversationTurnForAuthor as jest.MockedFunction<
  typeof createOrGetConversationTurnForAuthor
>
const createWorkspaceForAuthorMock = createWorkspaceForAuthor as jest.MockedFunction<
  typeof createWorkspaceForAuthor
>
const createNodeForAuthorMock = createNodeForAuthor as jest.MockedFunction<typeof createNodeForAuthor>
const createMessageForAuthorMock = createMessageForAuthor as jest.MockedFunction<typeof createMessageForAuthor>
const createMessageAnnotationForAuthorMock =
  createMessageAnnotationForAuthor as jest.MockedFunction<typeof createMessageAnnotationForAuthor>
const updateWorkspaceForAuthorMock = updateWorkspaceForAuthor as jest.MockedFunction<
  typeof updateWorkspaceForAuthor
>
const updateNodeForAuthorMock = updateNodeForAuthor as jest.MockedFunction<typeof updateNodeForAuthor>
const updateMessageForAuthorMock = updateMessageForAuthor as jest.MockedFunction<
  typeof updateMessageForAuthor
>
const updateConversationTurnForAuthorMock = updateConversationTurnForAuthor as jest.MockedFunction<
  typeof updateConversationTurnForAuthor
>
const deleteWorkspaceForAuthorMock = deleteWorkspaceForAuthor as jest.MockedFunction<
  typeof deleteWorkspaceForAuthor
>
const deleteNodeForAuthorMock = deleteNodeForAuthor as jest.MockedFunction<typeof deleteNodeForAuthor>
const deleteMessageForAuthorMock = deleteMessageForAuthor as jest.MockedFunction<
  typeof deleteMessageForAuthor
>
const getBranchEventMetadataFromRecordMock =
  getBranchEventMetadataFromRecord as jest.MockedFunction<
    typeof getBranchEventMetadataFromRecord
  >

const selfSessionUser: SessionUser = {
  id: '00000000-0000-4000-8000-000000000001',
  authUserId: 'auth:self',
  email: 'self@example.com',
  displayName: 'Self User',
}

const selfUserRecord = {
  id: selfSessionUser.id,
  authUserId: selfSessionUser.authUserId,
  email: selfSessionUser.email,
  displayName: selfSessionUser.displayName,
  creditBalance: 42,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const ownedWorkspaceRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Owned Workspace',
  summary: 'root summary',
  authorUserId: selfSessionUser.id,
  rootNodeId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const ownedNodeRecord = {
  id: ownedWorkspaceRecord.rootNodeId,
  workspaceId: ownedWorkspaceRecord.id,
  authorUserId: selfSessionUser.id,
  parentNodeId: ownedWorkspaceRecord.rootNodeId,
  depth: 0,
  type: 'decision' as const,
  title: 'Root',
  status: 'open' as const,
  confidence: 'medium' as const,
  summary: 'summary',
  conclusion: null,
  rationale: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const ownedBranchNodeRecord = {
  id: '77777777-7777-4777-8777-777777777777',
  workspaceId: ownedWorkspaceRecord.id,
  authorUserId: selfSessionUser.id,
  parentNodeId: ownedNodeRecord.id,
  depth: 1,
  type: 'option' as const,
  title: 'Branch Node',
  status: 'open' as const,
  confidence: 'medium' as const,
  summary: 'branch summary',
  conclusion: null,
  rationale: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const ownedMessageRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  authorUserId: selfSessionUser.id,
  nodeId: ownedNodeRecord.id,
  turnId: null,
  role: 'user' as const,
  content: 'hello',
  metadata: {},
  createdAt: '2026-03-20T00:00:00.000Z',
}

const ownedAssistantMessageRecord = {
  id: '55555555-5555-4555-8555-555555555555',
  authorUserId: selfSessionUser.id,
  nodeId: ownedNodeRecord.id,
  turnId: null,
  role: 'assistant' as const,
  content: 'assistant reply',
  metadata: {},
  createdAt: '2026-03-20T00:00:01.000Z',
}

const ownedConversationTurnRecord = {
  id: '44444444-4444-4444-8444-444444444444',
  nodeId: ownedNodeRecord.id,
  authorUserId: selfSessionUser.id,
  status: 'processing' as const,
  model: 'gpt-5',
  idempotencyKey: 'idempotency-key-1',
  error: null,
  completedAt: null,
  metadata: {},
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const ownedMessageAnnotationRecord = {
  id: '66666666-6666-4666-8666-666666666666',
  messageId: ownedMessageRecord.id,
  leadsToNodeId: ownedBranchNodeRecord.id,
  kind: 'branch' as const,
  quote: 'hello',
  startOffset: 0,
  endOffset: 5,
  selectorJson: {
    selector: [{ quote: 'hello', start: 0, end: 5 }],
  },
  createdByUserId: selfSessionUser.id,
  idempotencyKey: 'annotation-idempotency-key-1',
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  deletedAt: null,
}

const ownedSuggestionAnnotationRecord = {
  ...ownedMessageAnnotationRecord,
  id: '99999999-9999-4999-8999-999999999999',
  leadsToNodeId: null,
  kind: 'suggestion' as const,
  idempotencyKey: 'annotation-idempotency-key-suggest-1',
}

const ownedMessageBranchResult = {
  annotation: {
    id: ownedMessageAnnotationRecord.id,
    messageId: ownedMessageAnnotationRecord.messageId,
    leadsToNodeId: ownedBranchNodeRecord.id,
    kind: ownedMessageAnnotationRecord.kind,
    quote: ownedMessageAnnotationRecord.quote,
    startOffset: ownedMessageAnnotationRecord.startOffset,
    endOffset: ownedMessageAnnotationRecord.endOffset,
    selectorJson: ownedMessageAnnotationRecord.selectorJson,
    createdByUserId: ownedMessageAnnotationRecord.createdByUserId,
    createdAt: ownedMessageAnnotationRecord.createdAt,
    updatedAt: ownedMessageAnnotationRecord.updatedAt,
    deletedAt: ownedMessageAnnotationRecord.deletedAt,
  },
  branchNodeId: ownedBranchNodeRecord.id,
}

const ownedMessageAnnotationDeleteResult = {
  annotationId: ownedMessageAnnotationRecord.id,
  deletedBranchNodeId: ownedBranchNodeRecord.id,
  deletedNodeCount: 1,
  deletedMessageCount: 0,
}

const makeCaller = (sessionUser: SessionUser | null) => {
  const cookie =
    sessionUser === null ? undefined : `bdw_session=${createSession(sessionUser)}`

  const context = createAppRouterContext({
    headers: cookie ? { cookie } : {},
  })

  return appRouter.createCaller(context)
}

const expectTrpcError = async (
  promise: Promise<unknown>,
  code:
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'BAD_REQUEST'
    | 'INTERNAL_SERVER_ERROR',
  message: string,
) => {
  await expect(promise).rejects.toMatchObject({
    code,
    message,
  })
}

describe('tRPC user authorization integration', () => {
  beforeEach(() => {
    clearAllSessions()
    jest.clearAllMocks()
    getUserByIdMock.mockResolvedValue(selfUserRecord)
  })

  afterEach(() => {
    clearAllSessions()
    jest.restoreAllMocks()
  })

  test('usersList with valid session returns exactly one self user', async () => {
    const caller = makeCaller(selfSessionUser)

    const result = await caller.usersList()

    expect(result).toEqual([selfUserRecord])
    expect(getUserByIdMock).toHaveBeenCalledTimes(1)
    expect(getUserByIdMock).toHaveBeenCalledWith(selfSessionUser.id)
  })

  test('usersList without session returns UNAUTHORIZED', async () => {
    const caller = makeCaller(null)
    await expectTrpcError(caller.usersList(), 'UNAUTHORIZED', 'Authentication required.')
  })

  test('userById(self) returns user', async () => {
    const caller = makeCaller(selfSessionUser)

    const result = await caller.userById({ id: selfSessionUser.id })

    expect(result).toEqual(selfUserRecord)
    expect(getUserByIdMock).toHaveBeenCalledTimes(1)
    expect(getUserByIdMock).toHaveBeenCalledWith(selfSessionUser.id)
  })

  test('userById(otherUserId) returns FORBIDDEN', async () => {
    const caller = makeCaller(selfSessionUser)

    await expectTrpcError(
      caller.userById({ id: '00000000-0000-4000-8000-000000000999' }),
      'FORBIDDEN',
      'User access is forbidden.',
    )
  })

  test('userById without session returns UNAUTHORIZED', async () => {
    const caller = makeCaller(null)
    await expectTrpcError(
      caller.userById({ id: selfSessionUser.id }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
  })
})

describe('tRPC ownership integration', () => {
  beforeEach(() => {
    clearAllSessions()
    jest.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-openai-key'

    getUserByIdMock.mockResolvedValue(selfUserRecord)
    listWorkspacesByAuthorMock.mockResolvedValue([ownedWorkspaceRecord])
    getWorkspaceByIdForAuthorMock.mockImplementation(async (id: string, authorUserId: string) =>
      id === ownedWorkspaceRecord.id && authorUserId === selfSessionUser.id ? ownedWorkspaceRecord : null,
    )
    workspaceExistsMock.mockResolvedValue(false)

    listNodesByWorkspaceForAuthorMock.mockImplementation(async (workspaceId: string, authorUserId: string) =>
      workspaceId === ownedWorkspaceRecord.id && authorUserId === selfSessionUser.id ? [ownedNodeRecord] : [],
    )
    getNodeByIdForAuthorMock.mockImplementation(async (id: string, authorUserId: string) =>
      authorUserId === selfSessionUser.id
        ? (id === ownedNodeRecord.id
          ? ownedNodeRecord
          : id === ownedBranchNodeRecord.id
            ? ownedBranchNodeRecord
            : null)
        : null,
    )
    nodeExistsMock.mockResolvedValue(false)

    listMessagesForNodeForAuthorMock.mockImplementation(async (nodeId: string, authorUserId: string) =>
      nodeId === ownedNodeRecord.id && authorUserId === selfSessionUser.id ? [ownedMessageRecord] : [],
    )
    getMessageByIdForAuthorMock.mockImplementation(async (id: string, authorUserId: string) =>
      id === ownedMessageRecord.id && authorUserId === selfSessionUser.id ? ownedMessageRecord : null,
    )
    listMessageAnnotationsByMessageForAuthorMock.mockImplementation(
      async (messageId: string, authorUserId: string) =>
        messageId === ownedMessageRecord.id && authorUserId === selfSessionUser.id
          ? [ownedMessageAnnotationRecord]
          : [],
    )
    getMessageAnnotationByIdForAuthorMock.mockImplementation(async (annotationId: string, authorUserId: string) =>
      annotationId === ownedMessageAnnotationRecord.id && authorUserId === selfSessionUser.id
        ? ownedMessageAnnotationRecord
        : null,
    )
    softDeleteMessageAnnotationForAuthorMock.mockImplementation(async (annotationId: string) =>
      annotationId === ownedMessageAnnotationRecord.id
        ? { id: annotationId }
        : null,
    )
    transitionMessageAnnotationToSuggestionForAuthorMock.mockResolvedValue(null)
    branchMessageFromSelectionInTransactionMock.mockResolvedValue(ownedMessageBranchResult)
    getBranchEventMetadataFromRecordMock.mockReturnValue(null)
    messageAnnotationExistsMock.mockResolvedValue(false)
    messageExistsMock.mockResolvedValue(false)
    listParentMessagesUpToSourceForAuthorMock.mockResolvedValue([])

    createWorkspaceForAuthorMock.mockResolvedValue(ownedWorkspaceRecord)
    createNodeForAuthorMock.mockResolvedValue(ownedNodeRecord)
    createMessageForAuthorMock.mockImplementation(async (input) =>
      input.role === 'assistant' ? ownedAssistantMessageRecord : ownedMessageRecord,
    )
    createMessageAnnotationForAuthorMock.mockResolvedValue(ownedMessageAnnotationRecord)
    createOrGetConversationTurnForAuthorMock.mockResolvedValue({
      turn: ownedConversationTurnRecord,
      wasCreated: true,
    })
    updateWorkspaceForAuthorMock.mockResolvedValue(null)
    updateNodeForAuthorMock.mockResolvedValue(null)
    updateMessageForAuthorMock.mockResolvedValue(null)
    updateConversationTurnForAuthorMock.mockResolvedValue(null)
    deleteWorkspaceForAuthorMock.mockResolvedValue(null)
    deleteNodeForAuthorMock.mockResolvedValue(null)
    deleteMessageForAuthorMock.mockResolvedValue(null)
    jest.spyOn(selectProviderModule, 'selectProvider').mockReturnValue({
      id: 'mock-provider',
      generate: jest.fn(async () => ({
        content: ownedAssistantMessageRecord.content,
        finishReason: 'stop' as const,
        providerResponseId: 'mock-response-id',
        usage: { inputTokens: null, outputTokens: null, totalTokens: null },
      })),
    })
  })

  afterEach(() => {
    clearAllSessions()
    jest.restoreAllMocks()
  })

  test('owner succeeds on scoped list/read procedures', async () => {
    const caller = makeCaller(selfSessionUser)

    await expect(caller.workspacesList()).resolves.toEqual([ownedWorkspaceRecord])
    await expect(caller.workspaceById({ id: ownedWorkspaceRecord.id })).resolves.toEqual(ownedWorkspaceRecord)
    await expect(caller.nodesByWorkspace({ workspaceId: ownedWorkspaceRecord.id })).resolves.toEqual([
      ownedNodeRecord,
    ])
    await expect(caller.messagesByNode({ nodeId: ownedNodeRecord.id })).resolves.toEqual([ownedMessageRecord])
  })

  test('owner can list, suggest, delete annotation branch, and branch from selection', async () => {
    const caller = makeCaller(selfSessionUser)
    deleteNodeForAuthorMock.mockResolvedValueOnce({
      id: '77777777-7777-4777-8777-777777777777',
      deletedWorkspace: false,
      deletedNodeCount: 1,
      deletedMessageCount: 0,
    })
    createMessageAnnotationForAuthorMock.mockResolvedValueOnce(ownedSuggestionAnnotationRecord)
    const branchInput = {
      messageId: ownedMessageRecord.id,
      selection: {
        quote: 'hello',
        selectorJson: {
          selector: [{ quote: 'hello', start: 0, end: 5 }],
        },
        startOffset: 0,
        endOffset: 5,
      },
      idempotencyKey: 'annotation-branch-idem-1',
      newNodeMeta: {
        title: 'Branch title',
      },
    }
    const suggestInput = {
      messageId: ownedMessageRecord.id,
      selection: {
        quote: 'hello',
        selectorJson: {
          selector: [{ quote: 'hello', start: 0, end: 5 }],
        },
        startOffset: 0,
        endOffset: 5,
      },
      idempotencyKey: 'annotation-suggest-idem-1',
    }

    await expect(
      caller.messageAnnotationsByMessage({ messageId: ownedMessageRecord.id }),
    ).resolves.toEqual([ownedMessageAnnotationRecord])
    await expect(caller.messageSuggestFromSelection(suggestInput)).resolves.toEqual(
      ownedSuggestionAnnotationRecord,
    )
    await expect(
      caller.messageAnnotationDelete({ annotationId: ownedMessageAnnotationRecord.id }),
    ).resolves.toEqual(ownedMessageAnnotationDeleteResult)
    await expect(caller.messageBranchFromSelection(branchInput)).resolves.toEqual(
      ownedMessageBranchResult,
    )
    expect(softDeleteMessageAnnotationForAuthorMock).toHaveBeenCalledWith(
      ownedMessageAnnotationRecord.id,
      selfSessionUser.id,
    )
    expect(createMessageAnnotationForAuthorMock).toHaveBeenCalledWith({
      messageId: suggestInput.messageId,
      kind: 'suggestion',
      quote: suggestInput.selection.quote,
      selectorJson: suggestInput.selection.selectorJson,
      startOffset: suggestInput.selection.startOffset,
      endOffset: suggestInput.selection.endOffset,
      authorUserId: selfSessionUser.id,
      idempotencyKey: suggestInput.idempotencyKey,
    })
    expect(branchMessageFromSelectionInTransactionMock).toHaveBeenCalledWith({
      input: branchInput,
      currentUserId: selfSessionUser.id,
    })
  })

  test('cross-user annotation reads/writes are denied with FORBIDDEN', async () => {
    const caller = makeCaller(selfSessionUser)
    getMessageByIdForAuthorMock.mockResolvedValue(null)
    getMessageAnnotationByIdForAuthorMock.mockResolvedValue(null)
    messageAnnotationExistsMock.mockResolvedValue(true)
    messageExistsMock.mockResolvedValue(true)

    await expectTrpcError(
      caller.messageAnnotationsByMessage({
        messageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    await expectTrpcError(
      caller.messageSuggestFromSelection({
        messageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'annotation-suggest-idem-2',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    await expectTrpcError(
      caller.messageBranchFromSelection({
        messageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'annotation-branch-idem-2',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    await expectTrpcError(
      caller.messageAnnotationDelete({
        annotationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )
  })

  test('annotation list returns empty array for missing message', async () => {
    const caller = makeCaller(selfSessionUser)
    getMessageByIdForAuthorMock.mockResolvedValueOnce(null)
    messageExistsMock.mockResolvedValueOnce(false)

    await expect(
      caller.messageAnnotationsByMessage({
        messageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    ).resolves.toEqual([])
    expect(listMessageAnnotationsByMessageForAuthorMock).not.toHaveBeenCalled()
  })

  test('messageAnnotationDelete returns NOT_FOUND when annotation is missing', async () => {
    const caller = makeCaller(selfSessionUser)
    getMessageAnnotationByIdForAuthorMock.mockResolvedValueOnce(null)
    messageAnnotationExistsMock.mockResolvedValueOnce(false)

    await expectTrpcError(
      caller.messageAnnotationDelete({
        annotationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
      'NOT_FOUND',
      'Message annotation not found.',
    )
  })

  test('messageAnnotationDelete skips node deletion for suggestion annotation', async () => {
    const caller = makeCaller(selfSessionUser)
    getMessageAnnotationByIdForAuthorMock.mockResolvedValueOnce(ownedSuggestionAnnotationRecord)
    softDeleteMessageAnnotationForAuthorMock.mockResolvedValueOnce({
      id: ownedSuggestionAnnotationRecord.id,
    })

    await expect(
      caller.messageAnnotationDelete({
        annotationId: ownedSuggestionAnnotationRecord.id,
      }),
    ).resolves.toEqual({
      annotationId: ownedSuggestionAnnotationRecord.id,
      deletedBranchNodeId: null,
      deletedNodeCount: 0,
      deletedMessageCount: 0,
    })

    expect(deleteNodeForAuthorMock).not.toHaveBeenCalled()
    expect(softDeleteMessageAnnotationForAuthorMock).toHaveBeenCalledWith(
      ownedSuggestionAnnotationRecord.id,
      selfSessionUser.id,
    )
  })

  test('messageAnnotationDelete downgrades suggestion-branch after deleting linked node', async () => {
    const caller = makeCaller(selfSessionUser)
    const ownedSuggestionBranchAnnotation = {
      ...ownedMessageAnnotationRecord,
      id: 'abababab-abab-4bab-8bab-abababababab',
      kind: 'suggestion-branch' as const,
      leadsToNodeId: ownedBranchNodeRecord.id,
    }
    getMessageAnnotationByIdForAuthorMock.mockResolvedValueOnce(ownedSuggestionBranchAnnotation)
    deleteNodeForAuthorMock.mockResolvedValueOnce({
      id: ownedBranchNodeRecord.id,
      deletedWorkspace: false,
      deletedNodeCount: 1,
      deletedMessageCount: 0,
    })
    transitionMessageAnnotationToSuggestionForAuthorMock.mockResolvedValueOnce({
      ...ownedSuggestionBranchAnnotation,
      kind: 'suggestion',
      leadsToNodeId: null,
    })

    await expect(
      caller.messageAnnotationDelete({
        annotationId: ownedSuggestionBranchAnnotation.id,
      }),
    ).resolves.toEqual({
      annotationId: ownedSuggestionBranchAnnotation.id,
      deletedBranchNodeId: ownedBranchNodeRecord.id,
      deletedNodeCount: 1,
      deletedMessageCount: 0,
    })

    expect(deleteNodeForAuthorMock).toHaveBeenCalledWith(
      ownedBranchNodeRecord.id,
      selfSessionUser.id,
    )
    expect(transitionMessageAnnotationToSuggestionForAuthorMock).toHaveBeenCalledWith(
      ownedSuggestionBranchAnnotation.id,
      selfSessionUser.id,
    )
    expect(softDeleteMessageAnnotationForAuthorMock).not.toHaveBeenCalled()
  })

  test('messageSuggestFromSelection returns NOT_FOUND when message is missing', async () => {
    const caller = makeCaller(selfSessionUser)
    getMessageByIdForAuthorMock.mockResolvedValueOnce(null)
    messageExistsMock.mockResolvedValueOnce(false)

    await expectTrpcError(
      caller.messageSuggestFromSelection({
        messageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'annotation-suggest-idem-3',
      }),
      'NOT_FOUND',
      'Message not found.',
    )
  })

  test('messageSuggestFromSelection returns existing annotation when source annotation is provided', async () => {
    const caller = makeCaller(selfSessionUser)
    getMessageAnnotationByIdForAuthorMock.mockResolvedValueOnce(ownedSuggestionAnnotationRecord)

    await expect(
      caller.messageSuggestFromSelection({
        messageId: ownedMessageRecord.id,
        sourceAnnotationId: ownedSuggestionAnnotationRecord.id,
        selection: {
          quote: ownedSuggestionAnnotationRecord.quote,
          selectorJson: ownedSuggestionAnnotationRecord.selectorJson,
          startOffset: ownedSuggestionAnnotationRecord.startOffset,
          endOffset: ownedSuggestionAnnotationRecord.endOffset,
        },
        idempotencyKey: 'annotation-suggest-idem-invalid-1',
      }),
    ).resolves.toEqual(ownedSuggestionAnnotationRecord)
  })

  test('messageBranchFromSelection returns NOT_FOUND when message is missing', async () => {
    const caller = makeCaller(selfSessionUser)
    getMessageByIdForAuthorMock.mockResolvedValueOnce(null)
    messageExistsMock.mockResolvedValueOnce(false)

    await expectTrpcError(
      caller.messageBranchFromSelection({
        messageId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'annotation-branch-idem-3',
      }),
      'NOT_FOUND',
      'Message not found.',
    )
  })

  test('messageBranchFromSelection maps service conflict to CONFLICT', async () => {
    const caller = makeCaller(selfSessionUser)
    branchMessageFromSelectionInTransactionMock.mockRejectedValueOnce(
      new MessageBranchSelectionConflictError('Idempotency record exists without a branch node link.'),
    )

    await expectTrpcError(
      caller.messageBranchFromSelection({
        messageId: ownedMessageRecord.id,
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'annotation-branch-idem-4',
      }),
      'CONFLICT',
      'Idempotency record exists without a branch node link.',
    )
  })

  test('messageBranchFromSelection returns existing branch-linked annotation when source is already branch-linked', async () => {
    const caller = makeCaller(selfSessionUser)
    branchMessageFromSelectionInTransactionMock.mockResolvedValueOnce(ownedMessageBranchResult)

    await expect(
      caller.messageBranchFromSelection({
        messageId: ownedMessageRecord.id,
        sourceAnnotationId: ownedMessageAnnotationRecord.id,
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        annotationKind: 'branch',
        idempotencyKey: 'annotation-branch-idem-invalid-1',
      }),
    ).resolves.toEqual(ownedMessageBranchResult)
  })

  test('messageBranchFromSelection returns NOT_FOUND when service returns null', async () => {
    const caller = makeCaller(selfSessionUser)
    branchMessageFromSelectionInTransactionMock.mockResolvedValueOnce(null)

    await expectTrpcError(
      caller.messageBranchFromSelection({
        messageId: ownedMessageRecord.id,
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'annotation-branch-idem-6',
      }),
      'NOT_FOUND',
      'Message not found.',
    )
  })

  test('cross-user workspace read is denied with FORBIDDEN', async () => {
    const caller = makeCaller(selfSessionUser)
    getWorkspaceByIdForAuthorMock.mockResolvedValueOnce(null)
    workspaceExistsMock.mockResolvedValueOnce(true)

    await expectTrpcError(
      caller.workspaceById({ id: '99999999-9999-4999-8999-999999999999' }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )
  })

  test('cross-user workspace node listing is denied with FORBIDDEN', async () => {
    const caller = makeCaller(selfSessionUser)
    getWorkspaceByIdForAuthorMock.mockResolvedValueOnce(null)
    workspaceExistsMock.mockResolvedValueOnce(true)

    await expectTrpcError(
      caller.nodesByWorkspace({ workspaceId: '99999999-9999-4999-8999-999999999999' }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )
  })

  test('cross-user node message listing is denied with FORBIDDEN', async () => {
    const caller = makeCaller(selfSessionUser)
    getNodeByIdForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(true)

    await expectTrpcError(
      caller.messagesByNode({ nodeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )
  })

  test('scoped procedures without session are denied with UNAUTHORIZED', async () => {
    const caller = makeCaller(null)

    await expectTrpcError(caller.workspacesList(), 'UNAUTHORIZED', 'Authentication required.')
    await expectTrpcError(
      caller.nodesByWorkspace({ workspaceId: ownedWorkspaceRecord.id }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.messagesByNode({ nodeId: ownedNodeRecord.id }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.messageAnnotationsByMessage({ messageId: ownedMessageRecord.id }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.messageSuggestFromSelection({
        messageId: ownedMessageRecord.id,
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'annotation-suggest-idem-5',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.messageBranchFromSelection({
        messageId: ownedMessageRecord.id,
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'annotation-branch-idem-5',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.messageAnnotationDelete({
        annotationId: ownedMessageAnnotationRecord.id,
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
  })

  test('nodeCreate with missing workspace returns NOT_FOUND', async () => {
    const caller = makeCaller(selfSessionUser)
    getWorkspaceByIdForAuthorMock.mockResolvedValueOnce(null)
    workspaceExistsMock.mockResolvedValueOnce(false)

    await expectTrpcError(
      caller.nodeCreate({
        workspaceId: ownedWorkspaceRecord.id,
        parentNodeId: ownedNodeRecord.id,
        type: 'question',
        title: 'Follow-up',
        summary: 'Need more data',
      }),
      'NOT_FOUND',
      'Workspace not found.',
    )
  })

  test('nodeCreate with missing parent returns NOT_FOUND', async () => {
    const caller = makeCaller(selfSessionUser)
    getWorkspaceByIdForAuthorMock.mockResolvedValueOnce(ownedWorkspaceRecord)
    createNodeForAuthorMock.mockResolvedValueOnce(null)

    await expectTrpcError(
      caller.nodeCreate({
        workspaceId: ownedWorkspaceRecord.id,
        parentNodeId: 'missing-parent-node',
        type: 'question',
        title: 'Follow-up',
        summary: 'Need more data',
      }),
      'NOT_FOUND',
      'Parent node not found in workspace.',
    )
  })

  test('messageCreate with missing node returns NOT_FOUND', async () => {
    const caller = makeCaller(selfSessionUser)
    getNodeByIdForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(false)

    await expectTrpcError(
      caller.messageCreate({
        nodeId: ownedNodeRecord.id,
        role: 'user',
        content: 'Hello',
      }),
      'NOT_FOUND',
      'Node not found.',
    )
  })

  test('messageCreate race where insert returns no row returns NOT_FOUND', async () => {
    const caller = makeCaller(selfSessionUser)
    getNodeByIdForAuthorMock.mockResolvedValueOnce(ownedNodeRecord)
    createMessageForAuthorMock.mockResolvedValueOnce(null)

    await expectTrpcError(
      caller.messageCreate({
        nodeId: ownedNodeRecord.id,
        role: 'user',
        content: 'Hello',
      }),
      'NOT_FOUND',
      'Node not found.',
    )
  })

  test('conversationSend persists idempotent turn + user message for owner', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: ownedConversationTurnRecord,
      wasCreated: true,
    })
    createMessageForAuthorMock
      .mockResolvedValueOnce(ownedMessageRecord)
      .mockResolvedValueOnce(ownedAssistantMessageRecord)
    const finalizedTurnRecord: ConversationTurnRecord = {
      ...ownedConversationTurnRecord,
      status: 'completed',
      completedAt: '2026-03-20T00:00:01.000Z',
      updatedAt: '2026-03-20T00:00:01.000Z',
    }
    updateConversationTurnForAuthorMock.mockResolvedValueOnce(finalizedTurnRecord)

    const result = await caller.conversationSend({
      nodeId: ownedNodeRecord.id,
      text: 'hello',
      model: 'gpt-5',
      idempotencyKey: 'idempotency-key-1',
    })

    expect(createOrGetConversationTurnForAuthorMock).toHaveBeenCalledWith({
      nodeId: ownedNodeRecord.id,
      authorUserId: selfSessionUser.id,
      model: 'gpt-5',
      idempotencyKey: 'idempotency-key-1',
      status: 'processing',
    })
    expect(createMessageForAuthorMock).toHaveBeenCalledWith({
      nodeId: ownedNodeRecord.id,
      authorUserId: selfSessionUser.id,
      turnId: ownedConversationTurnRecord.id,
      role: 'user',
      content: 'hello',
    })
    expect(createMessageForAuthorMock).toHaveBeenCalledWith({
      nodeId: ownedNodeRecord.id,
      authorUserId: selfSessionUser.id,
      turnId: ownedConversationTurnRecord.id,
      role: 'assistant',
      content: ownedAssistantMessageRecord.content,
    })
    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: ownedConversationTurnRecord.id,
        status: 'completed',
        error: null,
        completedAt: expect.any(String),
      },
      selfSessionUser.id,
    )
    expect(result).toEqual({
      turnId: ownedConversationTurnRecord.id,
      status: 'completed',
      userMessage: ownedMessageRecord,
      assistantMessage: ownedAssistantMessageRecord,
      error: null,
    })
  })

  test('conversationSend duplicate idempotency key returns existing message without reinsert', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: {
        ...ownedConversationTurnRecord,
        status: 'processing',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
      wasCreated: false,
    })
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([ownedMessageRecord])

    const result = await caller.conversationSend({
      nodeId: ownedNodeRecord.id,
      text: 'hello',
      model: 'gpt-5',
      idempotencyKey: 'idempotency-key-1',
    })

    expect(createMessageForAuthorMock).not.toHaveBeenCalled()
    expect(result.userMessage.id).toBe(ownedMessageRecord.id)
    expect(result.turnId).toBe(ownedConversationTurnRecord.id)
  })

  test('conversationSend duplicate idempotency key recovers existing assistant message when present', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: {
        ...ownedConversationTurnRecord,
        status: 'completed',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
      wasCreated: false,
    })
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      ownedMessageRecord,
      ownedAssistantMessageRecord,
    ])

    const result = await caller.conversationSend({
      nodeId: ownedNodeRecord.id,
      text: 'hello',
      model: 'gpt-5',
      idempotencyKey: 'idempotency-key-1',
    })

    expect(result.assistantMessage?.id).toBe(ownedAssistantMessageRecord.id)
  })

  test('conversationSend duplicate idempotency key without recoverable message returns CONFLICT', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: {
        ...ownedConversationTurnRecord,
        createdAt: '2026-03-21T00:00:00.000Z',
      },
      wasCreated: false,
    })
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([ownedMessageRecord])

    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'CONFLICT',
      'A turn already exists for this idempotency key.',
    )
  })

  test('conversationSend with missing node returns NOT_FOUND', async () => {
    const caller = makeCaller(selfSessionUser)
    getNodeByIdForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(false)

    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'NOT_FOUND',
      'Node not found.',
    )
  })

  test('conversationSend turn creation race returns NOT_FOUND', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce(null)

    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'NOT_FOUND',
      'Node not found.',
    )
  })

  test('conversationSend with cross-user node returns FORBIDDEN', async () => {
    const caller = makeCaller(selfSessionUser)
    getNodeByIdForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(true)

    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )
  })

  test('conversationSend marks turn failed when user message insert returns no row', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: ownedConversationTurnRecord,
      wasCreated: true,
    })
    createMessageForAuthorMock.mockResolvedValueOnce(null)

    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'NOT_FOUND',
      'Node not found.',
    )

    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: ownedConversationTurnRecord.id,
        status: 'failed',
        error: 'Node not found.',
      },
      selfSessionUser.id,
    )
  })

  test('conversationSend marks turn failed when provider generation throws', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: ownedConversationTurnRecord,
      wasCreated: true,
    })
    createMessageForAuthorMock.mockResolvedValueOnce(ownedMessageRecord)
    const failingProvider = {
      id: 'failing-provider',
      generate: jest.fn(async () => {
        throw new Error('provider boom')
      }),
    }
    jest
      .spyOn(selectProviderModule, 'selectProvider')
      .mockReturnValueOnce(failingProvider)

    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'INTERNAL_SERVER_ERROR',
      'Assistant generation failed.',
    )

    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: ownedConversationTurnRecord.id,
        status: 'failed',
        error: 'provider boom',
      },
      selfSessionUser.id,
    )
  })

  test('conversationSend marks turn failed when assistant message insert returns no row', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: ownedConversationTurnRecord,
      wasCreated: true,
    })
    createMessageForAuthorMock
      .mockResolvedValueOnce(ownedMessageRecord)
      .mockResolvedValueOnce(null)

    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'NOT_FOUND',
      'Node not found.',
    )

    expect(updateConversationTurnForAuthorMock).toHaveBeenCalledWith(
      {
        id: ownedConversationTurnRecord.id,
        status: 'failed',
        error: 'Node not found.',
      },
      selfSessionUser.id,
    )
  })

  test('conversationSend returns NOT_FOUND when turn finalization update fails', async () => {
    const caller = makeCaller(selfSessionUser)
    createOrGetConversationTurnForAuthorMock.mockResolvedValueOnce({
      turn: ownedConversationTurnRecord,
      wasCreated: true,
    })
    createMessageForAuthorMock.mockResolvedValueOnce(ownedMessageRecord)
    updateConversationTurnForAuthorMock.mockResolvedValueOnce(null)

    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'NOT_FOUND',
      'Conversation turn not found.',
    )
  })

  test('owner succeeds on scoped write procedures', async () => {
    const caller = makeCaller(selfSessionUser)
    updateWorkspaceForAuthorMock.mockResolvedValueOnce({
      ...ownedWorkspaceRecord,
      title: 'Renamed Workspace',
    })
    updateNodeForAuthorMock.mockResolvedValueOnce({
      ...ownedNodeRecord,
      summary: 'Updated summary',
    })
    updateMessageForAuthorMock.mockResolvedValueOnce({
      ...ownedMessageRecord,
      content: 'Updated message',
    })
    deleteWorkspaceForAuthorMock.mockResolvedValueOnce({
      id: ownedWorkspaceRecord.id,
      deletedNodeCount: 3,
      deletedMessageCount: 8,
    })
    deleteNodeForAuthorMock.mockResolvedValueOnce({
      id: ownedNodeRecord.id,
      deletedWorkspace: false,
      deletedNodeCount: 2,
      deletedMessageCount: 4,
    })
    deleteMessageForAuthorMock.mockResolvedValueOnce({ id: ownedMessageRecord.id })

    await expect(
      caller.workspaceCreate({
        title: 'New Workspace',
        rootNodeTitle: 'Root',
        rootNodeSummary: '',
      }),
    ).resolves.toEqual(ownedWorkspaceRecord)
    await expect(
      caller.nodeCreate({
        workspaceId: ownedWorkspaceRecord.id,
        parentNodeId: ownedNodeRecord.id,
        type: 'question',
        title: 'Follow-up',
        summary: 'Need more data',
      }),
    ).resolves.toEqual(ownedNodeRecord)
    await expect(
      caller.messageCreate({
        nodeId: ownedNodeRecord.id,
        role: 'user',
        content: 'Hello',
      }),
    ).resolves.toEqual(ownedMessageRecord)

    await expect(
      caller.workspaceUpdate({
        id: ownedWorkspaceRecord.id,
        title: 'Renamed Workspace',
      }),
    ).resolves.toMatchObject({ title: 'Renamed Workspace' })
    await expect(
      caller.nodeUpdate({
        id: ownedNodeRecord.id,
        summary: 'Updated summary',
      }),
    ).resolves.toMatchObject({ summary: 'Updated summary' })
    await expect(
      caller.messageUpdate({
        id: ownedMessageRecord.id,
        content: 'Updated message',
      }),
    ).resolves.toMatchObject({ content: 'Updated message' })

    await expect(caller.workspaceDelete({ id: ownedWorkspaceRecord.id })).resolves.toEqual({
      id: ownedWorkspaceRecord.id,
      deletedNodeCount: 3,
      deletedMessageCount: 8,
    })
    await expect(caller.nodeDelete({ id: ownedNodeRecord.id })).resolves.toEqual({
      id: ownedNodeRecord.id,
      deletedWorkspace: false,
      deletedNodeCount: 2,
      deletedMessageCount: 4,
    })
    await expect(caller.messageDelete({ id: ownedMessageRecord.id })).resolves.toEqual({
      id: ownedMessageRecord.id,
    })
  })

  test('cross-user write procedures are denied with FORBIDDEN', async () => {
    const caller = makeCaller(selfSessionUser)

    updateWorkspaceForAuthorMock.mockResolvedValueOnce(null)
    workspaceExistsMock.mockResolvedValueOnce(true)
    await expectTrpcError(
      caller.workspaceUpdate({
        id: ownedWorkspaceRecord.id,
        title: 'Renamed',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    deleteWorkspaceForAuthorMock.mockResolvedValueOnce(null)
    workspaceExistsMock.mockResolvedValueOnce(true)
    await expectTrpcError(
      caller.workspaceDelete({ id: ownedWorkspaceRecord.id }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    updateNodeForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(true)
    await expectTrpcError(
      caller.nodeUpdate({
        id: ownedNodeRecord.id,
        summary: 'cross user write',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    deleteNodeForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(true)
    await expectTrpcError(
      caller.nodeDelete({ id: ownedNodeRecord.id }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    updateMessageForAuthorMock.mockResolvedValueOnce(null)
    messageExistsMock.mockResolvedValueOnce(true)
    await expectTrpcError(
      caller.messageUpdate({
        id: ownedMessageRecord.id,
        content: 'cross user write',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    deleteMessageForAuthorMock.mockResolvedValueOnce(null)
    messageExistsMock.mockResolvedValueOnce(true)
    await expectTrpcError(
      caller.messageDelete({ id: ownedMessageRecord.id }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    getWorkspaceByIdForAuthorMock.mockResolvedValueOnce(null)
    workspaceExistsMock.mockResolvedValueOnce(true)
    await expectTrpcError(
      caller.nodeCreate({
        workspaceId: ownedWorkspaceRecord.id,
        parentNodeId: ownedNodeRecord.id,
        type: 'question',
        title: 'Follow-up',
        summary: 'Need more data',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )

    getNodeByIdForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(true)
    await expectTrpcError(
      caller.messageCreate({
        nodeId: ownedNodeRecord.id,
        role: 'user',
        content: 'Hello',
      }),
      'FORBIDDEN',
      'Workspace access is forbidden.',
    )
  })

  test('write procedures without session are denied with UNAUTHORIZED', async () => {
    const caller = makeCaller(null)

    await expectTrpcError(
      caller.workspaceCreate({
        title: 'New Workspace',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.workspaceUpdate({
        id: ownedWorkspaceRecord.id,
        title: 'Renamed',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.workspaceDelete({ id: ownedWorkspaceRecord.id }),
      'UNAUTHORIZED',
      'Authentication required.',
    )

    await expectTrpcError(
      caller.nodeCreate({
        workspaceId: ownedWorkspaceRecord.id,
        parentNodeId: ownedNodeRecord.id,
        type: 'question',
        title: 'Follow-up',
        summary: 'Need more data',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.nodeUpdate({
        id: ownedNodeRecord.id,
        summary: 'Updated summary',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.nodeDelete({ id: ownedNodeRecord.id }),
      'UNAUTHORIZED',
      'Authentication required.',
    )

    await expectTrpcError(
      caller.messageCreate({
        nodeId: ownedNodeRecord.id,
        role: 'user',
        content: 'Hello',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.messageUpdate({
        id: ownedMessageRecord.id,
        content: 'Updated message',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.messageDelete({ id: ownedMessageRecord.id }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
    await expectTrpcError(
      caller.conversationSend({
        nodeId: ownedNodeRecord.id,
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
      'UNAUTHORIZED',
      'Authentication required.',
    )
  })

  test('nodesByWorkspace returns empty list for missing workspace and skips node list query', async () => {
    const caller = makeCaller(selfSessionUser)
    getWorkspaceByIdForAuthorMock.mockResolvedValueOnce(null)
    workspaceExistsMock.mockResolvedValueOnce(false)

    await expect(caller.nodesByWorkspace({ workspaceId: 'missing-workspace' })).resolves.toEqual([])
    expect(listNodesByWorkspaceForAuthorMock).not.toHaveBeenCalled()
  })

  test('messagesByNode returns empty list for missing node and skips message list query', async () => {
    const caller = makeCaller(selfSessionUser)
    getNodeByIdForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(false)

    await expect(caller.messagesByNode({ nodeId: 'missing-node' })).resolves.toEqual([])
    expect(listMessagesForNodeForAuthorMock).not.toHaveBeenCalled()
  })

  test('parentMessagesUpToSource delegates to the scoped parent-history query for owned nodes', async () => {
    const caller = makeCaller(selfSessionUser)
    getNodeByIdForAuthorMock.mockResolvedValueOnce(ownedNodeRecord)
    listParentMessagesUpToSourceForAuthorMock.mockResolvedValueOnce([ownedMessageRecord])

    await expect(
      caller.parentMessagesUpToSource({
        sourceNodeId: ownedNodeRecord.id,
        sourceMessageId: ownedMessageRecord.id,
      }),
    ).resolves.toEqual([ownedMessageRecord])

    expect(listParentMessagesUpToSourceForAuthorMock).toHaveBeenCalledWith(
      ownedNodeRecord.id,
      ownedMessageRecord.id,
      selfSessionUser.id,
    )
  })

  test('parentMessagesUpToSource returns empty list for missing node and skips parent-history query', async () => {
    const caller = makeCaller(selfSessionUser)
    getNodeByIdForAuthorMock.mockResolvedValueOnce(null)
    nodeExistsMock.mockResolvedValueOnce(false)

    await expect(
      caller.parentMessagesUpToSource({
        sourceNodeId: 'missing-node',
        sourceMessageId: ownedMessageRecord.id,
      }),
    ).resolves.toEqual([])
    expect(listParentMessagesUpToSourceForAuthorMock).not.toHaveBeenCalled()
  })

  test('inheritedMessagesByNode returns the full ancestor chain for nested branches', async () => {
    const caller = makeCaller(selfSessionUser)
    const branchEventMessageRecord = {
      ...ownedMessageRecord,
      id: 'branch-event-message',
      nodeId: ownedBranchNodeRecord.id,
      content: 'branch event',
    }
    const immediateParentMessages = [
      {
        ...ownedMessageRecord,
        id: 'parent-branch-event',
        nodeId: ownedNodeRecord.id,
      },
      {
        ...ownedAssistantMessageRecord,
        id: 'parent-source-message',
        nodeId: ownedNodeRecord.id,
      },
    ]
    const rootMessages = [
      {
        ...ownedMessageRecord,
        id: 'root-source-message',
        nodeId: 'root-node',
      },
    ]

    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([branchEventMessageRecord])
    getBranchEventMetadataFromRecordMock
      .mockReturnValueOnce({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: ownedNodeRecord.id,
        sourceMessageId: 'parent-source-message',
        branchNodeId: ownedBranchNodeRecord.id,
      })
      .mockReturnValueOnce({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: ownedNodeRecord.id,
        sourceMessageId: 'parent-source-message',
        branchNodeId: ownedBranchNodeRecord.id,
      })
      .mockReturnValueOnce({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: 'root-node',
        sourceMessageId: 'root-source-message',
        branchNodeId: ownedNodeRecord.id,
      })
      .mockReturnValueOnce({
        eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
        sourceNodeId: 'root-node',
        sourceMessageId: 'root-source-message',
        branchNodeId: ownedNodeRecord.id,
      })
      .mockReturnValueOnce(null)
    listParentMessagesUpToSourceForAuthorMock
      .mockResolvedValueOnce(immediateParentMessages)
      .mockResolvedValueOnce(rootMessages)

    await expect(
      caller.inheritedMessagesByNode({ nodeId: ownedBranchNodeRecord.id }),
    ).resolves.toEqual([...rootMessages, ...immediateParentMessages])

    expect(listMessagesForNodeForAuthorMock).toHaveBeenCalledWith(
      ownedBranchNodeRecord.id,
      selfSessionUser.id,
    )
    expect(listParentMessagesUpToSourceForAuthorMock).toHaveBeenNthCalledWith(
      1,
      ownedNodeRecord.id,
      'parent-source-message',
      selfSessionUser.id,
    )
    expect(listParentMessagesUpToSourceForAuthorMock).toHaveBeenNthCalledWith(
      2,
      'root-node',
      'root-source-message',
      selfSessionUser.id,
    )
  })
})
