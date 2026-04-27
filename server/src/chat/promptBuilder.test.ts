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
      `Response format requirements:
- Answer in clean Markdown format.
    - Use short Markdown headings (## or ###) to organize multi-part answers by default.
    - Use bold lead-ins or bold key conclusions to make important points easy to scan.
    - Use bullet points for collections, and use numbered points when order, priority, or steps matter.
    - For fixed-count or clearly delineated sets, use a numbered top-level list.
    - Avoid long paragraphs. Put thresholds or rules of thumb in a compact list.
    - Wrap code in triple-backtick fenced code blocks and include a language tag when possible.
- Keep responses concise:
    - Start with a high-level response that includes only necessary details.
    - Avoid low-level implementation details unless the user explicitly asks for them or continues with follow-up questions.
    - Avoid long responses on short question`,
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

  test('passes branch event messages through in conversation history', () => {
    const prompt = buildAssistantPrompt({
      node: {
        id: 'n-child',
        workspaceId: 'w1',
        title: 'Child Branch',
        summary: 'child summary',
        status: 'open',
        confidence: 'medium',
        conclusion: null,
        rationale: null,
        depth: 1,
        parentNodeId: 'n-parent',
      },
      recentMessages: [
        {
          id: 'm-branch-event',
          role: 'user',
          content: 'surrounding branch context',
          createdAt: '2026-03-30T00:03:00.000Z',
        },
        {
          id: 'm-child-followup',
          role: 'user',
          content: 'follow-up question',
          createdAt: '2026-03-30T00:04:00.000Z',
        },
      ],
      userInput: 'next child turn',
    })

    expect(prompt.conversation).toEqual([
      {
        id: 'm-branch-event',
        role: 'user',
        content: 'surrounding branch context',
        createdAt: '2026-03-30T00:03:00.000Z',
      },
      {
        id: 'm-child-followup',
        role: 'user',
        content: 'follow-up question',
        createdAt: '2026-03-30T00:04:00.000Z',
      },
    ])
  })
})
