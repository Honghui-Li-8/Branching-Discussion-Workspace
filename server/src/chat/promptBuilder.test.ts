import { describe, expect, test } from '@jest/globals'
import { buildAssistantPrompt } from './promptBuilder'

describe('buildAssistantPrompt', () => {
  test('builds the legacy prompt shape from conversation context', () => {
    const prompt = buildAssistantPrompt({
      node: {
        id: 'n1',
        workspaceId: 'w1',
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

    expect(prompt.instructions).toEqual([
      'Node title: Root Decision',
      'Node summary: Root summary',
      'Node status: open',
      'Node confidence: medium',
    ])
    expect(prompt.conversation).toEqual([
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        createdAt: '2026-03-30T00:00:00.000Z',
      },
    ])
    expect(prompt.currentUserMessage).toBe('new question')
    expect(prompt.retrievalContext).toEqual([])
    expect(prompt.input).toEqual([
      'Node title: Root Decision',
      'Node summary: Root summary',
      'Node status: open',
      'Node confidence: medium',
      'Recent messages:',
      '[user] hello',
      'User input: new question',
    ].join('\n'))
    expect(prompt.userInput).toBe('new question')
  })

  test('renders empty history fallback when there are no prior messages', () => {
    const prompt = buildAssistantPrompt({
      node: {
        id: 'n1',
        workspaceId: 'w1',
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

    expect(prompt.conversation).toEqual([])
    expect(prompt.currentUserMessage).toBe('hello')
    expect(prompt.retrievalContext).toEqual([])
    expect(prompt.input).toContain('No prior messages in this node.')
  })

  test('renders retrieved chunks when provided', () => {
    const prompt = buildAssistantPrompt(
      {
        node: {
          id: 'n1',
          workspaceId: 'w1',
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
      },
      {
        retrievedChunks: [
          {
            messageId: 'm-source',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'retrieved evidence',
          },
        ],
      },
    )

    expect(prompt.retrievalContext).toEqual([
      {
        messageId: 'm-source',
        nodeId: 'n1',
        chunkIndex: 0,
        content: 'retrieved evidence',
      },
    ])
    expect(prompt.input).toContain('Retrieved context:')
    expect(prompt.input).toContain('retrieved evidence')
  })
})
