import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from './constants.js'

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

export const serializeSessionCookie = (sessionId: string): string => {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}`
}

export const serializeClearedSessionCookie = (): string =>
  `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
