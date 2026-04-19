import { describe, expect, test } from '@jest/globals'
import {
  assistantAnnotationKindSchema,
  branchAndSendFollowupInputSchema,
  branchFollowupStatusResultSchema,
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

  describe('branchAndSendFollowupInputSchema', () => {
    const baseInput = {
      messageId: 'm1',
      selection: {
        quote: 'hello',
        selectorJson: { selector: [{ quote: 'hello', start: 0, end: 5 }] },
      },
      sourceContext: 'surrounding text',
      text: 'follow-up question',
      model: 'claude-sonnet-4-6',
      idempotencyKey: 'key-1',
    }

    test('accepts a valid fresh-branch input', () => {
      expect(() => branchAndSendFollowupInputSchema.parse(baseInput)).not.toThrow()
    })

    test('accepts annotationKind branch', () => {
      expect(() =>
        branchAndSendFollowupInputSchema.parse({ ...baseInput, annotationKind: 'branch' }),
      ).not.toThrow()
    })

    test('accepts suggestion-branch annotationKind when sourceAnnotationId is present', () => {
      expect(() =>
        branchAndSendFollowupInputSchema.parse({
          ...baseInput,
          annotationKind: 'suggestion-branch',
          sourceAnnotationId: 'a1',
        }),
      ).not.toThrow()
    })

    test('rejects suggestion-branch annotationKind without sourceAnnotationId', () => {
      expect(() =>
        branchAndSendFollowupInputSchema.parse({
          ...baseInput,
          annotationKind: 'suggestion-branch',
        }),
      ).toThrow()
    })

    test('rejects missing sourceContext', () => {
      const { sourceContext: _omit, ...withoutContext } = baseInput
      expect(() => branchAndSendFollowupInputSchema.parse(withoutContext)).toThrow()
    })

    test('rejects empty sourceContext', () => {
      expect(() =>
        branchAndSendFollowupInputSchema.parse({ ...baseInput, sourceContext: '' }),
      ).toThrow()
    })

    test('rejects empty text', () => {
      expect(() =>
        branchAndSendFollowupInputSchema.parse({ ...baseInput, text: '' }),
      ).toThrow()
    })
  })

  describe('branchFollowupStatusResultSchema', () => {
    test('accepts pending or processing status with nullable user message id', () => {
      expect(
        branchFollowupStatusResultSchema.parse({
          turnId: 't1',
          status: 'processing',
          userFollowupMessageId: null,
          error: null,
        }),
      ).toMatchObject({ turnId: 't1', status: 'processing' })
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
