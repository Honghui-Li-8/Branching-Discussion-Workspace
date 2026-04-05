import { describe, expect, test } from '@jest/globals'
import {
  buildBranchSelectionPayload,
  canSubmitBranchRequest,
} from './assistantBranchRequest'

describe('assistantBranchRequest', () => {
  test('allows branch submit only when no pending request exists', () => {
    expect(
      canSubmitBranchRequest({
        hasPendingBranchRequest: false,
        isBranchMutationPending: false,
      }),
    ).toBe(true)
    expect(
      canSubmitBranchRequest({
        hasPendingBranchRequest: true,
        isBranchMutationPending: false,
      }),
    ).toBe(false)
    expect(
      canSubmitBranchRequest({
        hasPendingBranchRequest: false,
        isBranchMutationPending: true,
      }),
    ).toBe(false)
  })

  test('buildBranchSelectionPayload normalizes selector ranges and computes offsets', () => {
    const payload = buildBranchSelectionPayload([
      { quote: '  first ', start: 2.9, end: 7.2 },
      { quote: 'second', start: 8, end: 14 },
    ])

    expect(payload).toEqual({
      quote: 'first second',
      selectorJson: {
        selector: [
          { quote: 'first', start: 2, end: 7 },
          { quote: 'second', start: 8, end: 14 },
        ],
      },
      startOffset: 2,
      endOffset: 14,
    })
  })

  test('buildBranchSelectionPayload rejects invalid ranges', () => {
    expect(
      buildBranchSelectionPayload([{ quote: ' ', start: 0, end: 2 }]),
    ).toBeNull()
    expect(
      buildBranchSelectionPayload([{ quote: 'x', start: 4, end: 4 }]),
    ).toBeNull()
    expect(
      buildBranchSelectionPayload([
        { quote: 'ok', start: 1, end: 2 },
        { quote: '', start: 2, end: 5 },
      ]),
    ).toEqual({
      quote: 'ok',
      selectorJson: {
        selector: [{ quote: 'ok', start: 1, end: 2 }],
      },
      startOffset: 1,
      endOffset: 2,
    })
  })
})
