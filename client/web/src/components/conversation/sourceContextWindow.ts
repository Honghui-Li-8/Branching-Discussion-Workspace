const SOURCE_CONTEXT_SIDE_WINDOW_CHARS = 160

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const moveStartToWordBoundary = (value: string, start: number): number => {
  let current = start
  while (current > 0 && /\S/.test(value[current - 1] ?? '')) {
    current -= 1
  }
  return current
}

const moveEndToWordBoundary = (value: string, end: number): number => {
  let current = end
  while (current < value.length && /\S/.test(value[current] ?? '')) {
    current += 1
  }
  return current
}

export const buildSourceContextWindow = ({
  sourceText,
  startOffset,
  endOffset,
}: {
  sourceText: string
  startOffset: number
  endOffset: number
}): string => {
  if (!sourceText.trim().length) {
    return ''
  }

  const maxOffset = sourceText.length
  const normalizedStartOffset = clamp(Math.floor(startOffset), 0, maxOffset)
  const normalizedEndOffset = clamp(Math.floor(endOffset), normalizedStartOffset, maxOffset)

  const windowStart = moveStartToWordBoundary(
    sourceText,
    Math.max(0, normalizedStartOffset - SOURCE_CONTEXT_SIDE_WINDOW_CHARS),
  )
  const windowEnd = moveEndToWordBoundary(
    sourceText,
    Math.min(maxOffset, normalizedEndOffset + SOURCE_CONTEXT_SIDE_WINDOW_CHARS),
  )

  const contextWindow = sourceText
    .slice(windowStart, windowEnd)
    .replace(/\s+/g, ' ')
    .trim()
  return contextWindow.length > 0
    ? contextWindow
    : sourceText.replace(/\s+/g, ' ').trim()
}
