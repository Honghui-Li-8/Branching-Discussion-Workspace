import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { appRouter } from './router.js'
import { clearAllSessions, createSession } from './auth/sessionStore.js'
import type { SessionUser } from './auth/types.js'
import { getUserById } from './db/index.js'
import { createAppRouterContext } from './trpcContext.js'

jest.mock('./db/index.js', () => ({
  createMessage: jest.fn(),
  createNode: jest.fn(),
  createWorkspace: jest.fn(),
  deleteMessage: jest.fn(),
  deleteNode: jest.fn(),
  deleteWorkspace: jest.fn(),
  getMessageById: jest.fn(),
  getNodeById: jest.fn(),
  getUserById: jest.fn(),
  getWorkspaceById: jest.fn(),
  listMessagesForNode: jest.fn(),
  listNodesByWorkspace: jest.fn(),
  listWorkspaces: jest.fn(),
  updateMessage: jest.fn(),
  updateNode: jest.fn(),
  updateWorkspace: jest.fn(),
}))

const getUserByIdMock = getUserById as jest.MockedFunction<typeof getUserById>

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

