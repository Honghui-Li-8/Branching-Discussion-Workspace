import { describe, expect, test } from '@jest/globals'
import {
  DEBUG_RAW_MARKDOWN,
  describeLocalAuthBypassMisconfiguration,
  isLocalAuthBypassAvailable,
  type LocalAuthBypassGateInput,
} from './devFlags'

describe('dev flags', () => {
  test('DEBUG_RAW_MARKDOWN must not be enabled in committed code', () => {
    expect(DEBUG_RAW_MARKDOWN).toBe(false)
  })
})

const validGateInput: LocalAuthBypassGateInput = {
  isViteDev: true,
  bypassEnabledFlag: 'true',
  hostname: 'localhost',
  devToken: 'local-dev-token',
}

describe('isLocalAuthBypassAvailable', () => {
  test('is available when all four conditions hold', () => {
    expect(isLocalAuthBypassAvailable(validGateInput)).toBe(true)
  })

  test('is unavailable outside Vite dev mode', () => {
    expect(isLocalAuthBypassAvailable({ ...validGateInput, isViteDev: false })).toBe(false)
  })

  test('is unavailable when the enable flag is not the string "true"', () => {
    expect(isLocalAuthBypassAvailable({ ...validGateInput, bypassEnabledFlag: 'false' })).toBe(false)
    expect(isLocalAuthBypassAvailable({ ...validGateInput, bypassEnabledFlag: undefined })).toBe(false)
  })

  test('is unavailable on a non-loopback hostname', () => {
    expect(isLocalAuthBypassAvailable({ ...validGateInput, hostname: 'example.com' })).toBe(false)
  })

  test('is unavailable when the dev token is empty or missing', () => {
    expect(isLocalAuthBypassAvailable({ ...validGateInput, devToken: '' })).toBe(false)
    expect(isLocalAuthBypassAvailable({ ...validGateInput, devToken: undefined })).toBe(false)
  })
})

describe('describeLocalAuthBypassMisconfiguration', () => {
  test('returns null when fully configured', () => {
    expect(describeLocalAuthBypassMisconfiguration(validGateInput)).toBeNull()
  })

  test('returns null outside Vite dev mode, even when nothing else is configured', () => {
    expect(
      describeLocalAuthBypassMisconfiguration({
        isViteDev: false,
        bypassEnabledFlag: undefined,
        hostname: 'example.com',
        devToken: undefined,
      }),
    ).toBeNull()
  })

  test('names the missing enable flag without printing the token', () => {
    const message = describeLocalAuthBypassMisconfiguration({
      ...validGateInput,
      bypassEnabledFlag: undefined,
    })
    expect(message).toContain('VITE_ENABLE_LOCAL_AUTH_BYPASS')
    expect(message).not.toContain(validGateInput.devToken)
  })

  test('names the non-loopback hostname condition without printing the token', () => {
    const message = describeLocalAuthBypassMisconfiguration({
      ...validGateInput,
      hostname: 'example.com',
    })
    expect(message).toContain('loopback')
    expect(message).not.toContain(validGateInput.devToken)
  })

  test('names the missing token variable without printing the token value', () => {
    const message = describeLocalAuthBypassMisconfiguration({
      ...validGateInput,
      devToken: undefined,
    })
    expect(message).toContain('VITE_DEV_AUTH_TOKEN')
    expect(message).not.toContain(validGateInput.devToken)
  })
})
