import type { Express, Request, Response } from 'express'
import {
  getOrCreateUserByAuthIdentity,
  getUserById,
  hasGrantTransaction,
  insertCreditTransaction,
  seedIntroWorkspace,
} from '../db/index.js'
import { getDevAuthToken } from './constants.js'
import {
  getSessionIdFromCookieHeader,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from './cookies.js'
import {
  createSession,
  deleteSession,
  getSessionUser,
} from './sessionStore.js'
import {
  getOrCreateUserFromVerifiedIdentity,
  verifyThirdPartyToken,
} from './provider.js'
import type { LoginRequestBody, SessionUser } from './types.js'
import { createLogger } from '../logging/logger.js'

const fallbackUser: SessionUser = {
  id: 'user-local-dev',
  authUserId: 'local:dev-user',
  email: 'dev@example.com',
  displayName: 'Local Dev',
}
const logger = createLogger('auth-routes')

const resolveDevSessionUser = (inputUser: LoginRequestBody['user']): SessionUser => ({
  id:
    typeof inputUser?.id === 'string' && inputUser.id.length > 0
      ? inputUser.id
      : fallbackUser.id,
  authUserId:
    typeof inputUser?.authUserId === 'string' && inputUser.authUserId.length > 0
      ? inputUser.authUserId
      : fallbackUser.authUserId,
  email:
    typeof inputUser?.email === 'string'
      ? inputUser.email
      : inputUser?.email === null
        ? null
        : fallbackUser.email,
  displayName:
    typeof inputUser?.displayName === 'string'
      ? inputUser.displayName
      : inputUser?.displayName === null
        ? null
        : fallbackUser.displayName,
})

const isThirdPartyAuthNotImplementedError = (error: unknown): boolean =>
  error instanceof Error && error.message === 'THIRD_PARTY_AUTH_NOT_IMPLEMENTED'

const normalizeProvider = (provider: unknown): string =>
  typeof provider === 'string' && provider.trim().length > 0 ? provider.trim() : 'google'

const resolvePersistedDevUser = async (inputUser: LoginRequestBody['user']): Promise<SessionUser> => {
  const resolvedUser = resolveDevSessionUser(inputUser)
  const persistedUser = await getOrCreateUserByAuthIdentity({
    authUserId: resolvedUser.authUserId,
    email: resolvedUser.email,
    displayName: resolvedUser.displayName,
  })

  return {
    id: persistedUser.id,
    authUserId: persistedUser.authUserId,
    email: persistedUser.email,
    displayName: persistedUser.displayName,
  }
}

export const handleLogin = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as LoginRequestBody
  const token = body.token

  if (typeof token !== 'string' || token.trim().length === 0) {
    res.status(400).json({ error: 'Missing auth token.' })
    return
  }

  let user: SessionUser

  try {
    const devAuthToken = getDevAuthToken()
    if (devAuthToken && token === devAuthToken) {
      user = await resolvePersistedDevUser(body.user)
      logger.info('[auth] dev login token accepted.', { auth_mode: 'dev_token' })
    } else {
      const provider = normalizeProvider(body.provider)
      const verifiedIdentity = await verifyThirdPartyToken(token, provider)
      user = await getOrCreateUserFromVerifiedIdentity(verifiedIdentity)
    }
  } catch (error) {
    if (isThirdPartyAuthNotImplementedError(error)) {
      res.status(501).json({ error: 'Third-party auth flow is not implemented yet.' })
      return
    }

    logger.error('[auth] Unexpected login verification error.', { error })
    res.status(401).json({ error: 'Invalid credential.' })
    return
  }

  try {
    // @todo(auth-onboarding): Move intro workspace provisioning to user onboarding.
    // This should be replaced by an idempotent server-side workflow with DB-level guarantees.
    await seedIntroWorkspace(user.id)
  } catch (error) {
    // Dev convenience should not block login.
    logger.warn('[auth] Intro workspace seeding failed; continuing login.', { error })
  }

  const alreadyGranted = await hasGrantTransaction(user.id)
  if (!alreadyGranted) {
    await insertCreditTransaction({
      userId: user.id,
      amount: 100_000,
      type: 'grant',
      reason: 'initial_grant',
    })
  }

  const fullUser = await getUserById(user.id)
  if (!fullUser) {
    res.status(500).json({ error: 'Failed to load user after login.' })
    return
  }

  const sessionId = createSession(user)
  res.setHeader('Set-Cookie', serializeSessionCookie(sessionId))
  res.json({ authenticated: true, user: fullUser })
}

export const handleMe = async (req: Request, res: Response): Promise<void> => {
  const sessionId = getSessionIdFromCookieHeader(req.headers.cookie)
  if (!sessionId) {
    res.status(401).json({ authenticated: false })
    return
  }

  const sessionUser = getSessionUser(sessionId)
  if (!sessionUser) {
    res.status(401).json({ authenticated: false })
    return
  }

  const user = await getUserById(sessionUser.id)
  if (!user) {
    res.status(401).json({ authenticated: false })
    return
  }

  res.json({ authenticated: true, user })
}

export const handleLogout = (req: Request, res: Response): void => {
  const sessionId = getSessionIdFromCookieHeader(req.headers.cookie)
  if (sessionId) {
    deleteSession(sessionId)
  }

  res.setHeader('Set-Cookie', serializeClearedSessionCookie())
  res.json({ authenticated: false })
}

export const registerAuthRoutes = (app: Express): void => {
  app.post('/auth/login', (req: Request, res: Response) => {
    void handleLogin(req, res).catch((error) => {
      logger.error('[auth] Unhandled login error.', { error })
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error.' })
      }
    })
  })

  app.get('/auth/me', handleMe)

  app.post('/auth/logout', handleLogout)
}
