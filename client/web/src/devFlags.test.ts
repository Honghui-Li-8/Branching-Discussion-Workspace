import { describe, expect, test } from '@jest/globals'
import { DEBUG_RAW_MARKDOWN } from './devFlags'

describe('dev flags', () => {
  test('DEBUG_RAW_MARKDOWN must not be enabled in committed code', () => {
    expect(DEBUG_RAW_MARKDOWN).toBe(false)
  })
})
