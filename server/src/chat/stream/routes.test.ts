import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { getSessionIdFromCookieHeader } from '../../auth/cookies.js'
import { getSessionUser } from '../../auth/sessionStore.js'
import {
  getConversationTurnByIdForAuthor,
  listConversationTurnEventsAfterIdForAuthor,
} from '../../db/index.js'
import { turnEventBroker } from './broker.js'
import type { ChatTurnStreamEvent } from './events.js'
import { handleConversationTurnStream } from './routes.js'

jest.mock('../../auth/cookies.js', () => ({
  getSessionIdFromCookieHeader: jest.fn(),
}))

jest.mock('../../auth/sessionStore.js', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('../../db/index.js', () => ({
  getConversationTurnByIdForAuthor: jest.fn(),
  listConversationTurnEventsAfterIdForAuthor: jest.fn(),
}))

const getSessionIdFromCookieHeaderMock = getSessionIdFromCookieHeader as jest.MockedFunction<
  typeof getSessionIdFromCookieHeader
>
const getSessionUserMock = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const getConversationTurnByIdForAuthorMock = getConversationTurnByIdForAuthor as jest.MockedFunction<
  typeof getConversationTurnByIdForAuthor
>
const listConversationTurnEventsAfterIdForAuthorMock =
  listConversationTurnEventsAfterIdForAuthor as jest.MockedFunction<
    typeof listConversationTurnEventsAfterIdForAuthor
  >

type MockStreamRequest = {
  headers: {
    cookie?: string
    'last-event-id'?: string
  }
  params: {
    turnId?: string
  }
  on: (event: 'close', handler: () => void) => MockStreamRequest
  triggerClose: () => void
}

type MockStreamResponse = {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  writes: string[]
  ended: boolean
  status: (code: number) => MockStreamResponse
  json: (payload: unknown) => MockStreamResponse
  setHeader: (name: string, value: string) => MockStreamResponse
  write: (chunk: string) => boolean
  end: () => MockStreamResponse
  on: (event: 'close', handler: () => void) => MockStreamResponse
  flushHeaders: () => void
  triggerClose: () => void
}

const createMockStreamRequest = (options?: {
  cookie?: string
  turnId?: string
  lastEventId?: string
}): MockStreamRequest => {
  const closeHandlers: Array<() => void> = []
  const request: MockStreamRequest = {
    headers: {
      cookie: options?.cookie,
      'last-event-id': options?.lastEventId,
    },
    params: { turnId: options?.turnId },
    on: (_event, handler) => {
      closeHandlers.push(handler)
      return request
    },
    triggerClose: () => {
      for (const handler of closeHandlers) {
        handler()
      }
    },
  }
  return request
}

const createMockStreamResponse = (): MockStreamResponse => {
  const closeHandlers: Array<() => void> = []

  const response: MockStreamResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    writes: [],
    ended: false,
    status: (code) => {
      response.statusCode = code
      return response
    },
    json: (payload) => {
      response.body = payload
      return response
    },
    setHeader: (name, value) => {
      response.headers[name.toLowerCase()] = value
      return response
    },
    write: (chunk) => {
      response.writes.push(chunk)
      return true
    },
    end: () => {
      response.ended = true
      return response
    },
    on: (_event, handler) => {
      closeHandlers.push(handler)
      return response
    },
    flushHeaders: () => {},
    triggerClose: () => {
      for (const handler of closeHandlers) {
        handler()
      }
    },
  }

  return response
}

describe('conversation turn stream route handler', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    turnEventBroker.clear()

    getSessionIdFromCookieHeaderMock.mockReturnValue('session-1')
    getSessionUserMock.mockReturnValue({
      id: 'user-1',
      authUserId: 'local:user-1',
      email: 'u1@example.com',
      displayName: 'User 1',
    })
    getConversationTurnByIdForAuthorMock.mockResolvedValue({
      id: 'turn-1',
      nodeId: 'node-1',
      authorUserId: 'user-1',
      status: 'processing',
      model: 'gpt-5.4-mini',
      idempotencyKey: 'idem-1',
      error: null,
      completedAt: null,
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:00:00.000Z',
    })
    listConversationTurnEventsAfterIdForAuthorMock.mockResolvedValue([])
  })

  afterEach(() => {
    jest.useRealTimers()
    turnEventBroker.clear()
  })

  test('returns UNAUTHORIZED when session is missing', async () => {
    getSessionIdFromCookieHeaderMock.mockReturnValue(null)
    const req = createMockStreamRequest({ turnId: 'turn-1' })
    const res = createMockStreamResponse()

    await handleConversationTurnStream(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Authentication required.' })
    expect(getConversationTurnByIdForAuthorMock).not.toHaveBeenCalled()
    expect(listConversationTurnEventsAfterIdForAuthorMock).not.toHaveBeenCalled()
  })

  test('returns NOT_FOUND when turn is absent or not owned', async () => {
    getConversationTurnByIdForAuthorMock.mockResolvedValueOnce(null)
    const req = createMockStreamRequest({ cookie: 'bdw_session=session-1', turnId: 'turn-404' })
    const res = createMockStreamResponse()

    await handleConversationTurnStream(req, res)

    expect(getConversationTurnByIdForAuthorMock).toHaveBeenCalledWith('turn-404', 'user-1')
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Conversation turn not found.' })
    expect(listConversationTurnEventsAfterIdForAuthorMock).not.toHaveBeenCalled()
  })

  test('streams heartbeat + published events and cleans up on disconnect', async () => {
    const req = createMockStreamRequest({ cookie: 'bdw_session=session-1', turnId: 'turn-1' })
    const res = createMockStreamResponse()

    await handleConversationTurnStream(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/event-stream')
    expect(res.headers['cache-control']).toBe('no-cache, no-transform')
    expect(res.headers.connection).toBe('keep-alive')
    expect(res.writes).toContain(': heartbeat\n\n')
    expect(turnEventBroker.listenerCount({ turnId: 'turn-1', authorUserId: 'user-1' })).toBe(1)
    expect(listConversationTurnEventsAfterIdForAuthorMock).toHaveBeenCalledWith(
      'turn-1',
      'user-1',
      0,
      200,
    )

    const event: ChatTurnStreamEvent = {
      turnId: 'turn-1',
      seq: 1,
      ts: '2026-03-31T00:00:00.000Z',
      type: 'turn.status',
      payload: {
        status: 'generating',
        detail: null,
      },
    }

    turnEventBroker.publish({
      turnId: 'turn-1',
      authorUserId: 'user-1',
      event,
    })

    const firstFrame = res.writes.join('')
    expect(firstFrame).toContain('event: turn.status')
    expect(firstFrame).toContain('"status":"generating"')
    expect(firstFrame).not.toContain('id: 1')

    jest.advanceTimersByTime(15_000)
    expect(res.writes.filter((chunk) => chunk === ': heartbeat\n\n').length).toBeGreaterThanOrEqual(2)

    const beforeCloseWrites = res.writes.length
    req.triggerClose()

    expect(res.ended).toBe(true)
    expect(turnEventBroker.listenerCount({ turnId: 'turn-1', authorUserId: 'user-1' })).toBe(0)

    turnEventBroker.publish({
      turnId: 'turn-1',
      authorUserId: 'user-1',
      event: {
        ...event,
        seq: 2,
      },
    })

    expect(res.writes.length).toBe(beforeCloseWrites)
  })

  test('replays durable events from Last-Event-ID cursor before broker subscription', async () => {
    listConversationTurnEventsAfterIdForAuthorMock.mockResolvedValueOnce([
      {
        id: 101,
        turnId: 'turn-1',
        seq: 7,
        eventType: 'summary.completed',
        payload: {
          jobId: 'job-1',
          jobType: 'summary',
          attemptCount: 1,
        },
        createdAt: '2026-03-31T00:00:07.000Z',
      },
    ])

    const req = createMockStreamRequest({
      cookie: 'bdw_session=session-1',
      turnId: 'turn-1',
      lastEventId: '100',
    })
    const res = createMockStreamResponse()

    await handleConversationTurnStream(req, res)

    expect(listConversationTurnEventsAfterIdForAuthorMock).toHaveBeenCalledWith(
      'turn-1',
      'user-1',
      100,
      200,
    )
    const frame = res.writes.join('')
    expect(frame).toContain('id: 101')
    expect(frame).toContain('event: summary.completed')
    expect(frame).toContain('"jobId":"job-1"')

    req.triggerClose()
  })

  test('polls durable log and streams newly persisted async events', async () => {
    listConversationTurnEventsAfterIdForAuthorMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 102,
          turnId: 'turn-1',
          seq: 8,
          eventType: 'summary.failed',
          payload: {
            jobId: 'job-1',
            jobType: 'summary',
            attemptCount: 2,
            terminal: false,
            error: 'summary timeout',
          },
          createdAt: '2026-03-31T00:00:08.000Z',
        },
      ])

    const req = createMockStreamRequest({ cookie: 'bdw_session=session-1', turnId: 'turn-1' })
    const res = createMockStreamResponse()
    await handleConversationTurnStream(req, res)

    jest.advanceTimersByTime(1_000)
    await Promise.resolve()
    await Promise.resolve()

    const frame = res.writes.join('')
    expect(frame).toContain('id: 102')
    expect(frame).toContain('event: summary.failed')
    expect(frame).toContain('"terminal":false')

    req.triggerClose()
  })
})
