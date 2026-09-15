import { isDevelopmentAppEnv, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from './constants.js'

export const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) {
    return {}
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf('=')
      if (separatorIndex < 0) {
        return acc
      }

      const key = part.slice(0, separatorIndex).trim()
      const rawValue = part.slice(separatorIndex + 1).trim()
      if (!key) {
        return acc
      }

      try {
        acc[key] = decodeURIComponent(rawValue)
      } catch {
        acc[key] = rawValue
      }
      return acc
    }, {})
}

export const getSessionIdFromCookieHeader = (cookieHeader?: string): string | null =>
  parseCookies(cookieHeader)[SESSION_COOKIE_NAME] ?? null

// One helper owns the whole attribute tail of both session cookies. `SameSite=None` is invalid
// without `Secure`, so the two are derived from a single boolean rather than decided separately --
// a shape in which the combination browsers silently drop cannot be expressed. APP_ENV is the
// environment signal (A00a introduced it precisely because NODE_ENV is untrustworthy here, and
// nothing in this repository ever sets NODE_ENV); anything that is not development is treated as
// hosted, so the fail-closed direction is `Secure`.
const sessionCookieAttributes = (maxAgeSeconds: number): string => {
  const secure = !isDevelopmentAppEnv()
  const sameSite = secure ? 'None' : 'Lax'
  return `Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`
}

export const serializeSessionCookie = (sessionId: string): string =>
  `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; ${sessionCookieAttributes(SESSION_TTL_SECONDS)}`

// The clearing cookie must carry the same SameSite/Secure pair as the cookie it overwrites, or the
// browser treats it as a different cookie and logout silently fails on the hosted origin.
export const serializeClearedSessionCookie = (): string =>
  `${SESSION_COOKIE_NAME}=; ${sessionCookieAttributes(0)}`
