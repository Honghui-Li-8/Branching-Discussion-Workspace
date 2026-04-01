import { describe, expect, test } from '@jest/globals'
import { createPlaceholderProvider } from './placeholderProvider'

describe('createPlaceholderProvider', () => {
  test('returns echo response from user input', async () => {
    const provider = createPlaceholderProvider()

    const result = await provider.generate({
      model: 'gpt-5',
      prompt: {
        instructions: ['Node title: Root'],
        conversation: [],
        currentUserMessage: 'hello world',
        retrievalContext: [],
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
