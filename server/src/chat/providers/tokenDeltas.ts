import type { GenerateAssistantInput } from '../types.js'

const splitIntoTokenDeltas = (content: string): string[] =>
  content
    .split(/(\s+)/)
    .filter((chunk) => chunk.length > 0)

export const emitTokenDeltas = async (
  content: string,
  onTokenDelta: GenerateAssistantInput['onTokenDelta'],
): Promise<void> => {
  if (!onTokenDelta) {
    return
  }

  for (const delta of splitIntoTokenDeltas(content)) {
    await onTokenDelta(delta)
  }
}
