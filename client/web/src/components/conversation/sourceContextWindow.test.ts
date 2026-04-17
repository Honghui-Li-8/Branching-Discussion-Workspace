import { describe, expect, test } from '@jest/globals'
import { buildSourceContextWindow } from './sourceContextWindow'

describe('buildSourceContextWindow', () => {
  test('returns a surrounding window that includes the selection', () => {
    const sourceText =
      'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.'
    const startOffset = sourceText.indexOf('lambda')
    const endOffset = startOffset + 'lambda mu nu'.length

    const result = buildSourceContextWindow({
      sourceText,
      startOffset,
      endOffset,
    })

    expect(result).toContain('lambda mu nu')
    expect(result.length).toBeGreaterThan('lambda mu nu'.length)
  })

  test('normalizes whitespace and falls back to the normalized source when bounds are invalid', () => {
    expect(
      buildSourceContextWindow({
        sourceText: '  One   two\nthree   ',
        startOffset: 999,
        endOffset: 1000,
      }),
    ).toBe('One two three')
  })
})
