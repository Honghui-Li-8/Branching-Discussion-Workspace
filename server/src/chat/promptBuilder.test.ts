import { describe, expect, test } from '@jest/globals'
import { buildAssistantPrompt } from './promptBuilder'

describe('buildAssistantPrompt', () => {
  test('builds the structured prompt envelope from conversation context', () => {
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
  })
})
