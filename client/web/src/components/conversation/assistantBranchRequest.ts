export type BranchSelectionRange = {
  quote: string
  start: number
  end: number
}

export type BranchSelectionPayload = {
  quote: string
  selectorJson: {
    selector: BranchSelectionRange[]
  }
  startOffset: number
  endOffset: number
}

export const canSubmitBranchRequest = ({
  hasPendingBranchRequest,
  isBranchMutationPending,
}: {
  hasPendingBranchRequest: boolean
  isBranchMutationPending: boolean
}): boolean => !hasPendingBranchRequest && !isBranchMutationPending

export const buildBranchSelectionPayload = (
  ranges: BranchSelectionRange[],
): BranchSelectionPayload | null => {
  const selector = ranges
    .map((range) => ({
      quote: range.quote.trim(),
      start: Math.floor(range.start),
      end: Math.floor(range.end),
    }))
    .filter(
      (range) =>
        range.quote.length > 0 &&
        Number.isFinite(range.start) &&
        Number.isFinite(range.end) &&
        range.end > range.start,
    )

  if (selector.length === 0) {
    return null
  }

  const quote = selector.map((range) => range.quote).join(' ').trim()
  if (!quote.length) {
    return null
  }

  return {
    quote,
    selectorJson: { selector },
    startOffset: Math.min(...selector.map((range) => range.start)),
    endOffset: Math.max(...selector.map((range) => range.end)),
  }
}
