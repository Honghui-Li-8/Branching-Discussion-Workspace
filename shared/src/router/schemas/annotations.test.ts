import { describe, expect, test } from '@jest/globals'
import {
  assistantAnnotationKindSchema,
  messageAnnotationSchema,
} from './annotations.js'

describe('annotation schema contracts', () => {
  describe('assistantAnnotationKindSchema', () => {
    test('accepts existing interactive kinds', () => {
      expect(assistantAnnotationKindSchema.parse('suggestion')).toBe('suggestion')
      expect(assistantAnnotationKindSchema.parse('branch')).toBe('branch')
      expect(assistantAnnotationKindSchema.parse('suggestion-branch')).toBe('suggestion-branch')
    })

    test('accepts branch-origin display-only kind', () => {
      expect(assistantAnnotationKindSchema.parse('branch-origin')).toBe('branch-origin')
    })

    test('rejects unknown kinds', () => {
      expect(() => assistantAnnotationKindSchema.parse('unknown')).toThrow()
      expect(() => assistantAnnotationKindSchema.parse('')).toThrow()
    })
  })

  describe('messageAnnotationSchema with branch-origin kind', () => {
    const fixedNow = '2026-03-17T00:00:00.000Z'

    test('parses a branch-origin annotation record', () => {
      expect(
        messageAnnotationSchema.parse({
          id: 'a1',
          messageId: 'msg-1',
          leadsToNodeId: null,
          kind: 'branch-origin',
          quote: 'selected text',
          startOffset: 0,
          endOffset: 13,
          selectorJson: { selector: [{ quote: 'selected text', start: 0, end: 13 }] },
          createdByUserId: 'u1',
          createdAt: fixedNow,
          updatedAt: fixedNow,
        }),
      ).toMatchObject({ kind: 'branch-origin', leadsToNodeId: null })
    })
  })
})
