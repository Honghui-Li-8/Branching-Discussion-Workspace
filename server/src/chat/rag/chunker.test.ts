import { describe, expect, test } from '@jest/globals'
import { chunkText } from './chunker'

describe('chunkText', () => {
  test('returns no chunks for empty text', () => {
    expect(chunkText('   ')).toEqual([])
  })

  test('splits oversized text deterministically', () => {
    const chunks = chunkText(
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda',
      { maxChars: 20 },
    )

    expect(chunks).toEqual([
      {
        chunkIndex: 0,
        content: 'alpha beta gamma',
        tokenCount: 4,
      },
      {
        chunkIndex: 1,
        content: 'delta epsilon zeta',
        tokenCount: 5,
      },
      {
        chunkIndex: 2,
        content: 'eta theta iota',
        tokenCount: 4,
      },
      {
        chunkIndex: 3,
        content: 'kappa lambda',
        tokenCount: 3,
      },
    ])
  })
})
