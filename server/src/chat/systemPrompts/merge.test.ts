import { TRPCError } from '@trpc/server'
import {
  MERGE_CONCLUSION_GENERATION_ERROR_MESSAGE,
  buildInitialMergeConclusionPrompt,
  buildRejectedMergeConclusionPrompt,
  parseMergeConclusionOutput,
} from './merge'

describe('merge system prompts', () => {
  const messages = [
    {
      id: 'm1',
      role: 'user' as const,
      content: 'We need realtime updates.',
      createdAt: '2026-04-26T00:00:00.000Z',
    },
    {
      id: 'm2',
      role: 'assistant' as const,
      content: 'GraphQL subscriptions fit the constraints.',
      createdAt: '2026-04-26T00:01:00.000Z',
    },
  ]

  test('buildInitialMergeConclusionPrompt requires structured JSON output', () => {
    const prompt = buildInitialMergeConclusionPrompt({
      branchTitle: 'Realtime API choice',
      branchSummary: 'Compared websocket and GraphQL options.',
      existingConclusion: 'Use GraphQL subscriptions.',
      messages,
    })

    expect(prompt.instructions).toEqual(
      expect.arrayContaining([
        'Branch title: Realtime API choice',
        'Branch summary: Compared websocket and GraphQL options.',
        'Existing branch conclusion: Use GraphQL subscriptions.',
        'Task: propose the conclusion that should be merged back into the parent conversation.',
      ]),
    )
    expect(prompt.instructions.join('\n')).toContain('{ "conclusion": "..." }')
    expect(prompt.instructions.join('\n')).toContain('Do not wrap the JSON in Markdown.')
    expect(prompt.conversation).toBe(messages)
    expect(prompt.currentUserMessage).toContain('Return only the required JSON object.')
    expect(prompt.retrievalContext).toEqual([])
  })

  test('buildRejectedMergeConclusionPrompt includes rejection instructions', () => {
    const prompt = buildRejectedMergeConclusionPrompt({
      branchTitle: 'Realtime API choice',
      messages,
      rejectionInstructions: 'Make it shorter and mention the caveat.',
    })

    expect(prompt.instructions).toEqual(
      expect.arrayContaining([
        'Branch summary: (none)',
        'Existing branch conclusion: (none)',
        'Task: rewrite the merge-back conclusion from scratch using the user rejection instructions.',
        'User rejection instructions: Make it shorter and mention the caveat.',
      ]),
    )
    expect(prompt.instructions.join('\n')).toContain('{ "conclusion": "..." }')
    expect(prompt.conversation).toBe(messages)
  })
})

describe('parseMergeConclusionOutput', () => {
  const expectGenerationError = (callback: () => unknown): void => {
    expect(callback).toThrow(TRPCError)

    try {
      callback()
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError)
      expect((error as TRPCError).code).toBe('INTERNAL_SERVER_ERROR')
      expect((error as TRPCError).message).toBe(MERGE_CONCLUSION_GENERATION_ERROR_MESSAGE)
    }
  }

  test('returns trimmed conclusion from valid JSON', () => {
    expect(
      parseMergeConclusionOutput(
        '  { "conclusion": "  Use GraphQL subscriptions for realtime updates.  " }  ',
      ),
    ).toBe('Use GraphQL subscriptions for realtime updates.')
  })

  test('rejects malformed JSON as a retriable AI service failure', () => {
    expectGenerationError(() => parseMergeConclusionOutput('```json\n{ "conclusion": "x" }\n```'))
  })

  test('rejects missing conclusion as a retriable AI service failure', () => {
    expectGenerationError(() => parseMergeConclusionOutput('{ "text": "Use GraphQL." }'))
  })

  test('rejects non-string conclusion as a retriable AI service failure', () => {
    expectGenerationError(() => parseMergeConclusionOutput('{ "conclusion": 42 }'))
  })

  test('rejects empty conclusion as a retriable AI service failure', () => {
    expectGenerationError(() => parseMergeConclusionOutput('{ "conclusion": "   " }'))
  })
})
