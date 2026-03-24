import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { appRouter } from './router.js'
import { clearAllSessions, createSession } from './auth/sessionStore.js'
import type { SessionUser } from './auth/types.js'
import {
  createMessageForAuthor,
  createNodeForAuthor,
  createWorkspace,
  deleteMessageForAuthor,
  deleteNodeForAuthor,
  deleteWorkspaceForAuthor,
  getNodeByIdForAuthor,
  getUserById,
  getWorkspaceByIdForAuthor,
  listMessagesForNodeForAuthor,
  listNodesByWorkspaceForAuthor,
  listWorkspacesByAuthor,
  messageExists,
  nodeExists,
  updateMessageForAuthor,
  updateNodeForAuthor,
  updateWorkspaceForAuthor,
  workspaceExists,
} from './db/index.js'
import { createAppRouterContext } from './trpcContext.js'

jest.mock('./db/index.js', () => ({
  createMessageForAuthor: jest.fn(),
  createNodeForAuthor: jest.fn(),
  createWorkspace: jest.fn(),
  deleteMessageForAuthor: jest.fn(),
  deleteNodeForAuthor: jest.fn(),
  deleteWorkspaceForAuthor: jest.fn(),
  getNodeByIdForAuthor: jest.fn(),
  getUserById: jest.fn(),
  getWorkspaceByIdForAuthor: jest.fn(),
  listMessagesForNodeForAuthor: jest.fn(),
  listNodesByWorkspaceForAuthor: jest.fn(),
  listWorkspacesByAuthor: jest.fn(),
  messageExists: jest.fn(),
  nodeExists: jest.fn(),
  updateMessageForAuthor: jest.fn(),
  updateNodeForAuthor: jest.fn(),
  updateWorkspaceForAuthor: jest.fn(),
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
const createWorkspaceMock = createWorkspace as jest.MockedFunction<typeof createWorkspace>
const createNodeForAuthorMock = createNodeForAuthor as jest.MockedFunction<typeof createNodeForAuthor>
const createMessageForAuthorMock = createMessageForAuthor as jest.MockedFunction<typeof createMessageForAuthor>
const updateWorkspaceForAuthorMock = updateWorkspaceForAuthor as jest.MockedFunction<
  typeof updateWorkspaceForAuthor
>
const updateNodeForAuthorMock = updateNodeForAuthor as jest.MockedFunction<typeof updateNodeForAuthor>
const updateMessageForAuthorMock = updateMessageForAuthor as jest.MockedFunction<
  typeof updateMessageForAuthor
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
  code: 'UNAUTHORIZED' | 'FORBIDDEN',
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

  test('userCreate with valid session returns FORBIDDEN', async () => {
    const caller = makeCaller(selfSessionUser)
    await expectTrpcError(
      caller.userCreate({
        authUserId: 'auth:new-user',
        email: 'new@example.com',
        displayName: 'New User',
      }),
      'FORBIDDEN',
      'User creation is managed by the auth flow.',
    )
  })

  test('userCreate without session returns UNAUTHORIZED', async () => {
    const caller = makeCaller(null)
    await expectTrpcError(
      caller.userCreate({
        authUserId: 'auth:new-user',
        email: 'new@example.com',
        displayName: 'New User',
      }),
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

    createWorkspaceMock.mockResolvedValue(ownedWorkspaceRecord)
    createNodeForAuthorMock.mockResolvedValue(ownedNodeRecord)
    createMessageForAuthorMock.mockResolvedValue(ownedMessageRecord)
    updateWorkspaceForAuthorMock.mockResolvedValue(null)
    updateNodeForAuthorMock.mockResolvedValue(null)
    updateMessageForAuthorMock.mockResolvedValue(null)
    deleteWorkspaceForAuthorMock.mockResolvedValue(null)
    deleteNodeForAuthorMock.mockResolvedValue(null)
    deleteMessageForAuthorMock.mockResolvedValue(null)
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
})
