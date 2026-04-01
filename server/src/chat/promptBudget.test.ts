import { describe, expect, test } from '@jest/globals'
import { applyPromptBudget } from './promptBudget'

describe('applyPromptBudget', () => {
  test('trims oldest conversation messages first and preserves the current user message', () => {
    const result = applyPromptBudget(
      {
        instructions: ['Node title: Root'],
        conversation: [
          {
            id: 'm1',
            role: 'user',
            content: 'aaaaa',
            createdAt: '2026-03-30T00:00:00.000Z',
          },
          {
            id: 'm2',
            role: 'assistant',
            content: 'bbbbb',
            createdAt: '2026-03-30T00:01:00.000Z',
          },
          {
            id: 'm3',
            role: 'user',
            content: 'ccccc',
            createdAt: '2026-03-30T00:02:00.000Z',
          },
        ],
        currentUserMessage: 'latest question',
        retrievalContext: [],
      },
      {
        maxConversationTokens: 12,
      },
    )

    expect(result.prompt.conversation).toEqual([
      {
        id: 'm2',
        role: 'assistant',
        content: 'bbbbb',
        createdAt: '2026-03-30T00:01:00.000Z',
      },
      {
        id: 'm3',
        role: 'user',
        content: 'ccccc',
        createdAt: '2026-03-30T00:02:00.000Z',
      },
    ])
    expect(result.prompt.currentUserMessage).toBe('latest question')
    expect(result.summary).toMatchObject({
      instructionCount: 1,
      conversationCountBefore: 3,
      conversationCountAfter: 2,
      trimmedConversationCount: 1,
      retrievalCountBefore: 0,
      retrievalCountAfter: 0,
      trimmedRetrievalCount: 0,
    })
  })

  test('caps retrieval context by count while keeping the original order', () => {
    const result = applyPromptBudget(
      {
        instructions: ['Node title: Root'],
        conversation: [],
        currentUserMessage: 'latest question',
        retrievalContext: [
          {
            messageId: 'm1',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'chunk-one',
          },
          {
            messageId: 'm2',
            nodeId: 'n1',
            chunkIndex: 1,
            content: 'chunk-two',
          },
          {
            messageId: 'm3',
            nodeId: 'n1',
            chunkIndex: 2,
            content: 'chunk-three',
          },
        ],
      },
      {
        maxRetrievalTokens: 100,
        maxRetrievalChunks: 2,
      },
    )

    expect(result.prompt.retrievalContext).toEqual([
      {
        messageId: 'm1',
        nodeId: 'n1',
        chunkIndex: 0,
        content: 'chunk-one',
      },
      {
        messageId: 'm2',
        nodeId: 'n1',
        chunkIndex: 1,
        content: 'chunk-two',
      },
    ])
    expect(result.summary).toMatchObject({
      retrievalCountBefore: 3,
      retrievalCountAfter: 2,
      trimmedRetrievalCount: 1,
    })
  })

  test('keeps the first retrieval chunk when it alone exceeds the token budget', () => {
    const result = applyPromptBudget(
      {
        instructions: ['Node title: Root'],
        conversation: [],
        currentUserMessage: 'latest question',
        retrievalContext: [
          {
            messageId: 'm1',
            nodeId: 'n1',
            chunkIndex: 0,
            content: 'oversized-chunk',
            tokenCount: 20,
          },
          {
            messageId: 'm2',
            nodeId: 'n1',
            chunkIndex: 1,
            content: 'later-chunk',
            tokenCount: 1,
          },
        ],
      },
      {
        maxRetrievalTokens: 8,
        maxRetrievalChunks: 6,
      },
    )

    expect(result.prompt.retrievalContext).toEqual([
      {
        messageId: 'm1',
        nodeId: 'n1',
        chunkIndex: 0,
        content: 'oversized-chunk',
        tokenCount: 20,
      },
    ])
    expect(result.summary).toMatchObject({
      retrievalCountBefore: 2,
      retrievalCountAfter: 1,
      trimmedRetrievalCount: 1,
    })
  })
})
