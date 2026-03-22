import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { Request, Response } from 'express'
import { getOrCreateUserByAuthIdentity, seedIntroWorkspace } from '../db/index.js'
import { clearAllSessions } from './sessionStore'
import { handleLogin, handleLogout, handleMe } from './routes'

jest.mock('node:crypto', () => {
  const actual = jest.requireActual('node:crypto') as typeof import('node:crypto')
  return {
    ...actual,
    randomUUID: jest.fn(() => 'mocked-session-id'),
  }
})

jest.mock('../db/index.js', () => ({
  getOrCreateUserByAuthIdentity: jest.fn(async () => ({
    id: '00000000-0000-4000-8000-000000000001',
    authUserId: 'local:dev-user',
    email: 'dev@example.com',
    displayName: 'Local Dev',
    creditBalance: 0,
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
  })),
  seedIntroWorkspace: jest.fn(async () => ({
    id: '10000000-0000-4000-8000-000000000001',
    title: 'Project Decision (dummy example)',
    authorUserId: '00000000-0000-4000-8000-000000000001',
    rootNodeId: '20000000-0000-4000-8000-000000000001',
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
  })),
}))

const getOrCreateUserByAuthIdentityMock = getOrCreateUserByAuthIdentity as jest.MockedFunction<
  typeof getOrCreateUserByAuthIdentity
>
const seedIntroWorkspaceMock = seedIntroWorkspace as jest.MockedFunction<typeof seedIntroWorkspace>

type AuthResponseBody = {
  authenticated?: unknown
  user?: {
    id: string
    authUserId: string
    email: string | null
    displayName: string | null
  }
  error?: unknown
}

type MockResponse = {
  statusCode: number
  headers: Record<string, string>
  body: AuthResponseBody | null
  status: (code: number) => MockResponse
  setHeader: (name: string, value: string) => MockResponse
  json: (payload: AuthResponseBody) => MockResponse
}

const createMockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      response.statusCode = code
      return response
    },
    setHeader(name: string, value: string) {
      response.headers[name.toLowerCase()] = value
      return response
    },
    json(payload: AuthResponseBody) {
      response.body = payload
      return response
    },
  }

  return response
}

const requestWithBody = (body: unknown): Request =>
  ({ body, headers: {} } as Request)

const requestWithCookie = (cookie: string): Request =>
  ({ headers: { cookie } } as Request)

describe('auth handlers', () => {
  beforeEach(() => {
    process.env.DEV_AUTH_TOKEN = 'dev-token-123'
    clearAllSessions()
    getOrCreateUserByAuthIdentityMock.mockClear()
    seedIntroWorkspaceMock.mockClear()
  })

  afterEach(() => {
    clearAllSessions()
    delete process.env.DEV_AUTH_TOKEN
    jest.restoreAllMocks()
  })

  test('handleLogin with dev token creates session and returns fallback user', async () => {
    const req = requestWithBody({ token: 'dev-token-123' })
    const res = createMockResponse()

    await handleLogin(req, res as unknown as Response)

    expect(res.statusCode).toBe(200)
    expect(res.body?.authenticated).toBe(true)
    expect(res.body?.user).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      authUserId: 'local:dev-user',
      email: 'dev@example.com',
      displayName: 'Local Dev',
    })
    expect(getOrCreateUserByAuthIdentityMock).toHaveBeenCalledTimes(1)
    expect(seedIntroWorkspaceMock).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001')
    expect(res.headers['set-cookie']).toContain('bdw_session=mocked-session-id')
    expect(res.headers['set-cookie']).toContain('HttpOnly')
  })

  test('handleMe returns authenticated user with valid session cookie', async () => {
    const loginReq = requestWithBody({ token: 'dev-token-123' })
    const loginRes = createMockResponse()
    await handleLogin(loginReq, loginRes as unknown as Response)

    const cookieHeader = loginRes.headers['set-cookie'].split(';')[0]
    const meReq = requestWithCookie(cookieHeader)
    const meRes = createMockResponse()

    handleMe(meReq, meRes as unknown as Response)

    expect(meRes.statusCode).toBe(200)
    expect(meRes.body?.authenticated).toBe(true)
    expect(meRes.body?.user?.id).toBe('00000000-0000-4000-8000-000000000001')
  })

  test('handleMe returns 401 when session cookie is missing', () => {
    const req = requestWithCookie('')
    const res = createMockResponse()

    handleMe(req, res as unknown as Response)

    expect(res.statusCode).toBe(401)
    expect(res.body?.authenticated).toBe(false)
  })

  test('handleLogin with non-dev token follows third-party shell and returns 501', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const req = requestWithBody({ token: 'google-token-placeholder', provider: 'google' })
    const res = createMockResponse()

    await handleLogin(req, res as unknown as Response)

    expect(res.statusCode).toBe(501)
    expect(res.body?.error).toBe('Third-party auth flow is not implemented yet.')
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(getOrCreateUserByAuthIdentityMock).not.toHaveBeenCalled()
    expect(seedIntroWorkspaceMock).not.toHaveBeenCalled()
  })

  test('handleLogout clears session and invalidates auth/me', async () => {
    const loginReq = requestWithBody({ token: 'dev-token-123' })
    const loginRes = createMockResponse()
    await handleLogin(loginReq, loginRes as unknown as Response)

    const cookieHeader = loginRes.headers['set-cookie'].split(';')[0]
    const logoutReq = requestWithCookie(cookieHeader)
    const logoutRes = createMockResponse()

    handleLogout(logoutReq, logoutRes as unknown as Response)

    expect(logoutRes.statusCode).toBe(200)
    expect(logoutRes.body?.authenticated).toBe(false)
    expect(logoutRes.headers['set-cookie']).toContain('Max-Age=0')

    const meReq = requestWithCookie(cookieHeader)
    const meRes = createMockResponse()
    handleMe(meReq, meRes as unknown as Response)

    expect(meRes.statusCode).toBe(401)
    expect(meRes.body?.authenticated).toBe(false)
  })
})
