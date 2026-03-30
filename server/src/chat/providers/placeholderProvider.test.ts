import { describe, expect, test } from '@jest/globals'
import { createPlaceholderProvider } from './placeholderProvider'

describe('createPlaceholderProvider', () => {
  test('returns echo response from user input', async () => {
    const provider = createPlaceholderProvider()

    const result = await provider.generate({
      model: 'gpt-5',
      context: {
        node: {
          id: 'n1',
          title: 'Root',
          summary: 'summary',
          status: 'open',
          confidence: 'medium',
          conclusion: null,
          rationale: null,
          depth: 0,
          parentNodeId: 'n1',
        },
        recentMessages: [],
        userInput: 'hello world',
      },
    })

    expect(provider.id).toBe('placeholder')
    expect(result).toEqual({
      content: 'echo - hello world',
      finishReason: 'stop',
      providerResponseId: null,
    })
  })
})
