import { describe, expect, test } from '@jest/globals'
import { isDebugRawMarkdownEnabled } from './devFlags'

describe('dev flags', () => {
  test('VITE_DEBUG_RAW_MARKDOWN must not be enabled in committed or CI environments', () => {
    // Fails intentionally if a dev leaves VITE_DEBUG_RAW_MARKDOWN=true in their
    // shell before pushing. Run with the flag unset (or set to anything other than
    // 'true') to pass.
    expect(process.env.VITE_DEBUG_RAW_MARKDOWN).not.toBe('true')
  })

  test('enables raw markdown from the Vite environment flag', () => {
    expect(
      isDebugRawMarkdownEnabled({
        viteEnv: { VITE_DEBUG_RAW_MARKDOWN: 'true' },
      }),
    ).toBe(true)
  })

  test('enables raw markdown from boolean Vite environment flag values', () => {
    expect(
      isDebugRawMarkdownEnabled({
        viteEnv: { VITE_DEBUG_RAW_MARKDOWN: true },
      }),
    ).toBe(true)
  })

  test('enables raw markdown from the runtime query flag', () => {
    expect(
      isDebugRawMarkdownEnabled({
        viteEnv: {},
        locationSearch: '?debugRawMarkdown=true',
      }),
    ).toBe(true)
  })

  test('enables raw markdown from query-like params after a hash', () => {
    expect(
      isDebugRawMarkdownEnabled({
        viteEnv: {},
        locationSearch: '',
        locationHash: '#/workspace?debugRawMarkdown=true',
      }),
    ).toBe(true)
  })

  test('enables raw markdown from localStorage', () => {
    expect(
      isDebugRawMarkdownEnabled({
        viteEnv: {},
        locationSearch: '',
        localStorageValue: 'true',
      }),
    ).toBe(true)
  })

  test('keeps rendered markdown on by default', () => {
    expect(
      isDebugRawMarkdownEnabled({
        viteEnv: {},
        locationSearch: '',
        localStorageValue: null,
      }),
    ).toBe(false)
  })
})
