export interface TextChunk {
  chunkIndex: number
  content: string
  tokenCount: number
}

export interface ChunkTextOptions {
  maxChars?: number
}

const DEFAULT_MAX_CHARS = 800

const estimateTokenCount = (text: string): number =>
  Math.max(1, Math.ceil(text.length / 4))

export const chunkText = (
  text: string,
  options: ChunkTextOptions = {},
): TextChunk[] => {
  const normalized = text.trim()
  if (normalized.length === 0) {
    return []
  }

  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const chunks: TextChunk[] = []
  let remaining = normalized
  let chunkIndex = 0

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push({
        chunkIndex,
        content: remaining,
        tokenCount: estimateTokenCount(remaining),
      })
      break
    }

    const slice = remaining.slice(0, maxChars)
    const splitAt = Math.max(
      slice.lastIndexOf('\n'),
      slice.lastIndexOf(' '),
    )
    const boundary = splitAt > Math.floor(maxChars / 2) ? splitAt : maxChars
    const content = remaining.slice(0, boundary).trim()

    chunks.push({
      chunkIndex,
      content,
      tokenCount: estimateTokenCount(content),
    })

    remaining = remaining.slice(boundary).trimStart()
    chunkIndex += 1
  }

  return chunks
}
