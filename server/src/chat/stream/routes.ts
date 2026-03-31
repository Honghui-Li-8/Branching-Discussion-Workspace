import type { Express, Request, Response } from 'express'
import { getSessionIdFromCookieHeader } from '../../auth/cookies.js'
import { getSessionUser } from '../../auth/sessionStore.js'
import { getConversationTurnByIdForAuthor } from '../../db/index.js'
import type { ChatTurnStreamEvent } from './events.js'
import { turnEventBroker } from './broker.js'

const HEARTBEAT_INTERVAL_MS = 15_000
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
  res.write(`id: ${event.seq}\n`)
  res.write(`event: ${event.type}\n`)
  res.write(`data: ${JSON.stringify(event)}\n\n`)
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

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const unsubscribe = turnEventBroker.subscribe({
    turnId,
    authorUserId: sessionUser.id,
    onEvent: (event) => writeSseEvent(res, event),
  })

  writeSseHeartbeat(res)
  const heartbeatTimer = setInterval(() => {
    writeSseHeartbeat(res)
  }, HEARTBEAT_INTERVAL_MS)

  let closed = false
  const closeStream = () => {
    if (closed) {
      return
    }
    closed = true
    clearInterval(heartbeatTimer)
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
