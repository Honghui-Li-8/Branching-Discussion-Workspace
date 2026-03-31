import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { appRouter } from './router.js'
import { clearAllSessions, createSession } from './auth/sessionStore.js'
import type { SessionUser } from './auth/types.js'
import {
  createOrGetConversationTurnForAuthor,
  createMessageForAuthor,
  createNodeForAuthor,
  createWorkspaceForAuthor,
  deleteMessageForAuthor,
  deleteNodeForAuthor,
  deleteWorkspaceForAuthor,
  getNodeByIdForAuthor,
  getUserById,
  getWorkspaceByIdForAuthor,
  listMessagesForNodeForAuthor,
  listNodesByWorkspaceForAuthor,
  listWorkspacesByAuthor,
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
import { createAppRouterContext } from './trpcContext.js'
import * as selectProviderModule from './chat/providers/selectProvider.js'

jest.mock('./db/index.js', () => ({
  createOrGetConversationTurnForAuthor: jest.fn(),
  createMessageForAuthor: jest.fn(),
  createNodeForAuthor: jest.fn(),
  createWorkspaceForAuthor: jest.fn(),
  deleteMessageForAuthor: jest.fn(),
  deleteNodeForAuthor: jest.fn(),
  deleteWorkspaceForAuthor: jest.fn(),
  getNodeByIdForAuthor: jest.fn(),
  getUserById: jest.fn(),
  getWorkspaceByIdForAuthor: jest.fn(),
  listMessagesForNodeForAuthor: jest.fn(),
  listNodesByWorkspaceForAuthor: jest.fn(),
  listWorkspacesByAuthor: jest.fn(),
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

const getUserByIdMock = getUserById as jest.MockedFunction<typeof getUserById>
const listWorkspacesByAuthorMock = listWorkspacesByAuthor as jest.MockedFunction<
  typeof listWorkspacesByAuthor
>
const getWorkspaceByIdForAuthorMock = getWorkspaceByIdForAuthor as jest.MockedFunction<
  typeof getWorkspaceByIdForAuthor
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
const messageExistsMock = messageExists as jest.MockedFunction<typeof messageExists>
const createOrGetConversationTurnForAuthorMock = createOrGetConversationTurnForAuthor as jest.MockedFunction<
  typeof createOrGetConversationTurnForAuthor
>
const createWorkspaceForAuthorMock = createWorkspaceForAuthor as jest.MockedFunction<
  typeof createWorkspaceForAuthor
>
const createNodeForAuthorMock = createNodeForAuthor as jest.MockedFunction<typeof createNodeForAuthor>
const createMessageForAuthorMock = createMessageForAuthor as jest.MockedFunction<typeof createMessageForAuthor>
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

const ownedMessageRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  authorUserId: selfSessionUser.id,
  nodeId: ownedNodeRecord.id,
  role: 'user' as const,
  content: 'hello',
  createdAt: '2026-03-20T00:00:00.000Z',
}

const ownedAssistantMessageRecord = {
  id: '55555555-5555-4555-8555-555555555555',
  authorUserId: selfSessionUser.id,
  nodeId: ownedNodeRecord.id,
  role: 'assistant' as const,
  content: 'assistant reply',
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
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
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
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_SERVER_ERROR',
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
      id === ownedNodeRecord.id && authorUserId === selfSessionUser.id ? ownedNodeRecord : null,
    )
    nodeExistsMock.mockResolvedValue(false)

    listMessagesForNodeForAuthorMock.mockImplementation(async (nodeId: string, authorUserId: string) =>
      nodeId === ownedNodeRecord.id && authorUserId === selfSessionUser.id ? [ownedMessageRecord] : [],
    )
    messageExistsMock.mockResolvedValue(false)

    createWorkspaceForAuthorMock.mockResolvedValue(ownedWorkspaceRecord)
    createNodeForAuthorMock.mockResolvedValue(ownedNodeRecord)
    createMessageForAuthorMock.mockImplementation(async (input) =>
      input.role === 'assistant' ? ownedAssistantMessageRecord : ownedMessageRecord,
    )
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
      role: 'user',
      content: 'hello',
    })
    expect(createMessageForAuthorMock).toHaveBeenCalledWith({
      nodeId: ownedNodeRecord.id,
      authorUserId: selfSessionUser.id,
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
})
