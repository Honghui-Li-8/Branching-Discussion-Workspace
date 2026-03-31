import type { Express, Request, Response } from 'express'
import { getSessionIdFromCookieHeader } from '../../auth/cookies.js'
import { getSessionUser } from '../../auth/sessionStore.js'
import {
  getConversationTurnByIdForAuthor,
  listConversationTurnEventsAfterIdForAuthor,
} from '../../db/index.js'
import {
  type ChatTurnStreamEvent,
  validateChatTurnStreamEvent,
} from './events.js'
import { turnEventBroker } from './broker.js'

const HEARTBEAT_INTERVAL_MS = 15_000
const EVENT_POLL_INTERVAL_MS = 1_000
const REPLAY_BATCH_LIMIT = 200
export const CONVERSATION_TURN_STREAM_ROUTE = '/chat/turns/:turnId/stream'

type StreamRequest = {
  headers: Request['headers']
  params: Request['params']
  on: (event: 'close', handler: () => void) => void
}

type StreamResponse = {
  status: (statusCode: number) => StreamResponse
  json: (payload: unknown) => StreamResponse
  setHeader: (name: string, value: string) => StreamResponse | void
  write: (chunk: string) => boolean | void
  end: () => StreamResponse | void
  on: (event: 'close', handler: () => void) => void
  flushHeaders?: () => void
}

const writeSseHeartbeat = (res: StreamResponse): void => {
  res.write(': heartbeat\n\n')
}

const writeSseEvent = (res: StreamResponse, event: ChatTurnStreamEvent): void => {
  res.write(`id: ${event.eventId ?? event.seq}\n`)
  res.write(`event: ${event.type}\n`)
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

const parseLastEventIdHeader = (
  rawHeaderValue: string | string[] | undefined,
): number => {
  const value = Array.isArray(rawHeaderValue)
    ? rawHeaderValue[0]
    : rawHeaderValue
  if (!value) {
    return 0
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return parsed
}

const toReplayStreamEvent = (row: {
  id: number
  turnId: string
  seq: number
  eventType: string
  payload: unknown
  createdAt: string
}): ChatTurnStreamEvent | null => {
  try {
    return validateChatTurnStreamEvent({
      turnId: row.turnId,
      seq: row.seq,
      eventId: row.id,
      ts: row.createdAt,
      type: row.eventType,
      payload: row.payload,
    })
  } catch (_error) {
    return null
  }
}

export const handleConversationTurnStream = async (
  req: StreamRequest,
  res: StreamResponse,
): Promise<void> => {
  const sessionId = getSessionIdFromCookieHeader(req.headers.cookie)
  const sessionUser = sessionId ? getSessionUser(sessionId) : null

  if (!sessionUser) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }

  const turnId = typeof req.params.turnId === 'string' ? req.params.turnId.trim() : ''
  if (!turnId) {
    res.status(400).json({ error: 'turnId is required.' })
    return
  }

  const turn = await getConversationTurnByIdForAuthor(turnId, sessionUser.id)
  if (!turn) {
    res.status(404).json({ error: 'Conversation turn not found.' })
    return
  }
  let lastEventId = parseLastEventIdHeader(req.headers['last-event-id'])

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const replayRows = await listConversationTurnEventsAfterIdForAuthor(
    turnId,
    sessionUser.id,
    lastEventId,
    REPLAY_BATCH_LIMIT,
  )
  for (const row of replayRows) {
    const replayEvent = toReplayStreamEvent(row)
    if (!replayEvent) {
      continue
    }
    writeSseEvent(res, replayEvent)
    lastEventId = Math.max(lastEventId, row.id)
  }

  const unsubscribe = turnEventBroker.subscribe({
    turnId,
    authorUserId: sessionUser.id,
    onEvent: (event) => {
      if (event.eventId) {
        lastEventId = Math.max(lastEventId, event.eventId)
      }
      writeSseEvent(res, event)
    },
  })

  let closed = false
  writeSseHeartbeat(res)
  const heartbeatTimer = setInterval(() => {
    writeSseHeartbeat(res)
  }, HEARTBEAT_INTERVAL_MS)
  let isPolling = false
  const pollTimer = setInterval(() => {
    if (isPolling || closed) {
      return
    }
    isPolling = true

    listConversationTurnEventsAfterIdForAuthor(
      turnId,
      sessionUser.id,
      lastEventId,
      REPLAY_BATCH_LIMIT,
    )
      .then((rows) => {
        if (closed || rows.length === 0) {
          return
        }

        for (const row of rows) {
          const replayEvent = toReplayStreamEvent(row)
          if (!replayEvent) {
            continue
          }
          writeSseEvent(res, replayEvent)
          lastEventId = Math.max(lastEventId, row.id)
        }
      })
      .catch((error) => {
        console.warn('[chat-stream] Failed to poll replay events.', {
          turnId,
          userId: sessionUser.id,
          error,
        })
      })
      .finally(() => {
        isPolling = false
      })
  }, EVENT_POLL_INTERVAL_MS)

  const closeStream = () => {
    if (closed) {
      return
    }
    closed = true
    clearInterval(heartbeatTimer)
    clearInterval(pollTimer)
    unsubscribe()
    res.end()
  }

  req.on('close', closeStream)
  res.on('close', closeStream)
}

export const registerConversationStreamRoutes = (app: Express): void => {
  app.get(CONVERSATION_TURN_STREAM_ROUTE, (req, res) => {
    handleConversationTurnStream(req, res)
      .catch((error) => {
        console.error('[chat-stream] Failed to open turn stream.', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to open conversation stream.' })
          return
        }
        res.end()
      })
  })
}
