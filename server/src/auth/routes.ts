import type { Express, Request, Response } from 'express'
import { getOrCreateUserByAuthIdentity, seedIntroWorkspace } from '../db/index.js'
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

const fallbackUser: SessionUser = {
  id: 'user-local-dev',
  authUserId: 'local:dev-user',
  email: 'dev@example.com',
  displayName: 'Local Dev',
}

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
      console.log("dev time quick login");
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

    console.error('[auth] Unexpected login verification error.', error)
    res.status(401).json({ error: 'Invalid credential.' })
    return
  }

  try {
    // @todo(auth-onboarding): Move intro workspace provisioning to user onboarding.
    // This should be replaced by an idempotent server-side workflow with DB-level guarantees.
    await seedIntroWorkspace(user.id)
  } catch (error) {
    // Dev convenience should not block login.
    console.warn('[auth] Intro workspace seeding failed; continuing login.', error)
  }

  const sessionId = createSession(user)
  res.setHeader('Set-Cookie', serializeSessionCookie(sessionId))
  res.json({ authenticated: true, user })
}

export const handleMe = (req: Request, res: Response): void => {
  const sessionId = getSessionIdFromCookieHeader(req.headers.cookie)
  if (!sessionId) {
    res.status(401).json({ authenticated: false })
    return
  }

  const user = getSessionUser(sessionId)
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
      console.error('[auth] Unhandled login error.', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error.' })
      }
    })
  })

  app.get('/auth/me', handleMe)

  app.post('/auth/logout', handleLogout)
}
