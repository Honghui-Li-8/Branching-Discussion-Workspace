import { describe, expect, test } from '@jest/globals'
import { buildAssistantPrompt } from './promptBuilder'

describe('buildAssistantPrompt', () => {
  test('builds the legacy prompt shape from conversation context', () => {
    const prompt = buildAssistantPrompt({
      node: {
        id: 'n1',
        title: 'Root Decision',
        summary: 'Root summary',
        status: 'open',
        confidence: 'medium',
        conclusion: null,
        rationale: null,
        depth: 0,
        parentNodeId: 'n1',
      },
      recentMessages: [
        {
          id: 'm1',
          role: 'user',
          content: 'hello',
          createdAt: '2026-03-30T00:00:00.000Z',
        },
      ],
      userInput: 'new question',
    })

    expect(prompt).toEqual({
      input: [
        'Node title: Root Decision',
        'Node summary: Root summary',
        'Node status: open',
        'Node confidence: medium',
        'Recent messages:',
        '[user] hello',
        'User input: new question',
      ].join('\n'),
      userInput: 'new question',
    })
  })

  test('renders empty history fallback when there are no prior messages', () => {
    const prompt = buildAssistantPrompt({
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
      userInput: 'hello',
    })

    expect(prompt.input).toContain('No prior messages in this node.')
  })
})
