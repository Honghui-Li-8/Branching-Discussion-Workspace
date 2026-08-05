import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import {
  assertSafeHostedAuthConfig,
  evaluateLocalAuthPolicy,
  isLoopbackOrigin,
} from './constants'

describe('isLoopbackOrigin', () => {
  test('accepts loopback origins with or without a port', () => {
    expect(isLoopbackOrigin('http://localhost:5173')).toBe(true)
    expect(isLoopbackOrigin('http://127.0.0.1:4000')).toBe(true)
    expect(isLoopbackOrigin('http://[::1]:5173')).toBe(true)
    expect(isLoopbackOrigin('http://localhost')).toBe(true)
  })

  test('rejects non-loopback, https, suffix-domain, and missing origins', () => {
    expect(isLoopbackOrigin('https://example.com')).toBe(false)
    expect(isLoopbackOrigin('http://evil.com')).toBe(false)
    expect(isLoopbackOrigin('http://localhost.attacker.com')).toBe(false)
    expect(isLoopbackOrigin(undefined)).toBe(false)
  })
})

describe('evaluateLocalAuthPolicy', () => {
  const allowedInput = { presentedToken: 'dev-token-123', origin: 'http://localhost:5173' }

  beforeEach(() => {
    process.env.APP_ENV = 'development'
    process.env.DEV_AUTH_ENABLED = 'true'
    process.env.DEV_AUTH_TOKEN = 'dev-token-123'
  })

  afterEach(() => {
    delete process.env.APP_ENV
    delete process.env.DEV_AUTH_ENABLED
    delete process.env.DEV_AUTH_TOKEN
  })

  test('allows when environment, flag, token, and origin all hold', () => {
    expect(evaluateLocalAuthPolicy(allowedInput)).toBe(true)
  })

  test('rejects when APP_ENV is not development', () => {
    process.env.APP_ENV = 'production'
    expect(evaluateLocalAuthPolicy(allowedInput)).toBe(false)
  })

  test('rejects when DEV_AUTH_ENABLED is not true', () => {
    delete process.env.DEV_AUTH_ENABLED
    expect(evaluateLocalAuthPolicy(allowedInput)).toBe(false)
  })

  test('rejects when the presented token does not match', () => {
    expect(evaluateLocalAuthPolicy({ ...allowedInput, presentedToken: 'wrong-token' })).toBe(false)
  })

  test('rejects when DEV_AUTH_TOKEN is not configured', () => {
    delete process.env.DEV_AUTH_TOKEN
    expect(evaluateLocalAuthPolicy(allowedInput)).toBe(false)
  })

  test('rejects when the origin is not loopback', () => {
    expect(evaluateLocalAuthPolicy({ ...allowedInput, origin: 'https://example.com' })).toBe(false)
  })
})

describe('assertSafeHostedAuthConfig', () => {
  afterEach(() => {
    delete process.env.APP_ENV
    delete process.env.DEV_AUTH_ENABLED
    delete process.env.DEV_AUTH_TOKEN
    delete process.env.AUTH_BACKDOOR_TOKEN
  })

  test('does not throw when APP_ENV=development regardless of other flags', () => {
    process.env.APP_ENV = 'development'
    process.env.DEV_AUTH_ENABLED = 'true'
    process.env.DEV_AUTH_TOKEN = 'dev-token-123'
    process.env.AUTH_BACKDOOR_TOKEN = 'legacy-token'
    expect(() => assertSafeHostedAuthConfig()).not.toThrow()
  })

  test('does not throw when APP_ENV is unset and nothing else is set', () => {
    expect(() => assertSafeHostedAuthConfig()).not.toThrow()
  })

  test('throws when DEV_AUTH_ENABLED is set outside development', () => {
    process.env.DEV_AUTH_ENABLED = 'true'
    expect(() => assertSafeHostedAuthConfig()).toThrow(/DEV_AUTH_ENABLED/)
  })

  test('throws when DEV_AUTH_TOKEN is set outside development', () => {
    process.env.DEV_AUTH_TOKEN = 'dev-token-123'
    expect(() => assertSafeHostedAuthConfig()).toThrow(/DEV_AUTH_TOKEN/)
  })

  test('throws when the legacy AUTH_BACKDOOR_TOKEN alias is set outside development', () => {
    process.env.AUTH_BACKDOOR_TOKEN = 'legacy-token'
    expect(() => assertSafeHostedAuthConfig()).toThrow(/AUTH_BACKDOOR_TOKEN/)
  })

  test('throws when APP_ENV is production and dev-auth config is set', () => {
    process.env.APP_ENV = 'production'
    process.env.DEV_AUTH_ENABLED = 'true'
    expect(() => assertSafeHostedAuthConfig()).toThrow(/APP_ENV=development/)
  })
})
