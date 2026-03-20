import { randomUUID } from 'node:crypto'
import {
  SESSION_CLEANUP_INTERVAL_MS,
  SESSION_TTL_SECONDS,
} from './constants.js'
import type { SessionRecord, SessionUser } from './types.js'

const sessions = new Map<string, SessionRecord>()

export const createSession = (user: SessionUser): string => {
  const sessionId = randomUUID()
  sessions.set(sessionId, {
    user,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  })
  return sessionId
}

export const getSessionUser = (sessionId: string): SessionUser | null => {
  const record = sessions.get(sessionId)
  if (!record) {
    return null
  }

  if (Date.now() >= record.expiresAt) {
    sessions.delete(sessionId)
    return null
  }

  return record.user
}

export const deleteSession = (sessionId: string): void => {
  sessions.delete(sessionId)
}

export const clearAllSessions = (): void => {
  sessions.clear()
}

export const pruneExpiredSessions = (): number => {
  const now = Date.now()
  let removed = 0

  for (const [sessionId, record] of sessions.entries()) {
    if (now >= record.expiresAt) {
      sessions.delete(sessionId)
      removed += 1
    }
  }

  return removed
}

export const startSessionCleanup = (): NodeJS.Timeout => {
  const timer = setInterval(() => {
    pruneExpiredSessions()
  }, SESSION_CLEANUP_INTERVAL_MS)
  timer.unref()
  return timer
}
