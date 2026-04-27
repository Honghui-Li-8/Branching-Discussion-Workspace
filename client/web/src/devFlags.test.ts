import { describe, expect, test } from '@jest/globals'

describe('dev flags', () => {
  test('VITE_DEBUG_RAW_MARKDOWN must not be enabled in committed or CI environments', () => {
    // Fails intentionally if a dev leaves VITE_DEBUG_RAW_MARKDOWN=true in their
    // shell before pushing. Run with the flag unset (or set to anything other than
    // 'true') to pass.
    expect(process.env.VITE_DEBUG_RAW_MARKDOWN).not.toBe('true')
  })
})
