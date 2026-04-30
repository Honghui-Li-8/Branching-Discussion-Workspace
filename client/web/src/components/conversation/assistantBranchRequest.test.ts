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

  test('canSubmitBranchRequest is false when both guard flags are set simultaneously', () => {
    // Both flags being true at once is a valid concurrent state (e.g. the previous
    // mutation is still in-flight when the user re-selects). The guard must still block.
    expect(
      canSubmitBranchRequest({
        hasPendingBranchRequest: true,
        isBranchMutationPending: true,
      }),
    ).toBe(false)
  })

  test('buildBranchSelectionPayload uses the minimum start and maximum end across all ranges', () => {
    // When a selection spans multiple disjoint ranges (e.g. user selected text across
    // two separate paragraphs), startOffset must be the smallest range start and
    // endOffset must be the largest range end so the branch covers the full selection.
    const payload = buildBranchSelectionPayload([
      { quote: 'last fragment', start: 50, end: 63 },
      { quote: 'first fragment', start: 5, end: 19 },
      { quote: 'middle bit', start: 25, end: 35 },
    ])

    expect(payload).not.toBeNull()
    expect(payload?.startOffset).toBe(5)   // min of [50, 5, 25]
    expect(payload?.endOffset).toBe(63)    // max of [63, 19, 35]
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
