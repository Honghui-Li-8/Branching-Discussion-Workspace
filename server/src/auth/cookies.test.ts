import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import {
  getSessionIdFromCookieHeader,
  parseCookies,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from './cookies'

// The literal Set-Cookie strings, asserted in full rather than by substring. A substring assertion
// would pass while `SameSite=None` shipped without `Secure` -- the exact combination browsers drop.
const HOSTED_SESSION =
  'bdw_session=session-id; Path=/; HttpOnly; SameSite=None; Max-Age=604800; Secure'
const DEV_SESSION = 'bdw_session=session-id; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'
const HOSTED_CLEARED = 'bdw_session=; Path=/; HttpOnly; SameSite=None; Max-Age=0; Secure'
const DEV_CLEARED = 'bdw_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'

describe('session cookie serialization', () => {
  // NODE_ENV is set to 'test' by the runner, so it is restored rather than deleted -- this suite
  // proves NODE_ENV is ignored, it must not change it for neighbouring suites.
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    delete process.env.APP_ENV
  })

  afterEach(() => {
    delete process.env.APP_ENV
    process.env.NODE_ENV = originalNodeEnv
  })

  test('APP_ENV=development yields the development strings: SameSite=Lax and no Secure', () => {
    process.env.APP_ENV = 'development'
    expect(serializeSessionCookie('session-id')).toBe(DEV_SESSION)
    expect(serializeClearedSessionCookie()).toBe(DEV_CLEARED)
  })

  test('APP_ENV unset yields the hosted strings (the fail-closed case)', () => {
    expect(serializeSessionCookie('session-id')).toBe(HOSTED_SESSION)
    expect(serializeClearedSessionCookie()).toBe(HOSTED_CLEARED)
  })

  // Set-but-empty reaches isDevelopmentAppEnv() as a different process.env state than "unset" --
  // a dashboard that stores a blank value, or a bare `APP_ENV=` line -- so it gets its own case.
  test('APP_ENV set but empty yields the hosted strings', () => {
    process.env.APP_ENV = ''
    expect(serializeSessionCookie('session-id')).toBe(HOSTED_SESSION)
    expect(serializeClearedSessionCookie()).toBe(HOSTED_CLEARED)
  })

  test('APP_ENV=review yields the hosted strings', () => {
    process.env.APP_ENV = 'review'
    expect(serializeSessionCookie('session-id')).toBe(HOSTED_SESSION)
    expect(serializeClearedSessionCookie()).toBe(HOSTED_CLEARED)
  })

  test('NODE_ENV=production has no effect on the cookie; APP_ENV decides', () => {
    process.env.NODE_ENV = 'production'
    process.env.APP_ENV = 'development'
    expect(serializeSessionCookie('session-id')).toBe(DEV_SESSION)
    expect(serializeClearedSessionCookie()).toBe(DEV_CLEARED)
  })

  test('the session id is URI-encoded in the cookie value', () => {
    process.env.APP_ENV = 'development'
    expect(serializeSessionCookie('a/b c')).toBe(
      'bdw_session=a%2Fb%20c; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800',
    )
  })
})

describe('parseCookies / getSessionIdFromCookieHeader', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'development'
  })

  afterEach(() => {
    delete process.env.APP_ENV
  })

  test('round-trips a serialized session cookie value', () => {
    const cookiePair = serializeSessionCookie('a/b c').split(';')[0]
    expect(getSessionIdFromCookieHeader(cookiePair)).toBe('a/b c')
  })

  test('parses multiple cookies and ignores malformed parts', () => {
    expect(parseCookies('a=1; bdw_session=xyz; broken; =novalue')).toEqual({
      a: '1',
      bdw_session: 'xyz',
    })
  })

  test('returns null when there is no cookie header or no session cookie', () => {
    expect(getSessionIdFromCookieHeader(undefined)).toBeNull()
    expect(getSessionIdFromCookieHeader('other=1')).toBeNull()
  })
})
