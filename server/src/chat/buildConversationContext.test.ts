import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  getNodeByIdForAuthor,
  listMessagesForNodeForAuthor,
} from '../db/index.js'
import {
  buildConversationContext,
  DEFAULT_RECENT_MESSAGE_LIMIT,
} from './buildConversationContext'

jest.mock('../db/index.js', () => ({
  getNodeByIdForAuthor: jest.fn(),
  listMessagesForNodeForAuthor: jest.fn(),
}))

const getNodeByIdForAuthorMock = getNodeByIdForAuthor as jest.MockedFunction<
  typeof getNodeByIdForAuthor
>
const listMessagesForNodeForAuthorMock = listMessagesForNodeForAuthor as jest.MockedFunction<
  typeof listMessagesForNodeForAuthor
>

const nodeRecord = {
  id: 'n1',
  workspaceId: 'w1',
  authorUserId: 'u1',
  parentNodeId: 'n1',
  depth: 0,
  type: 'decision' as const,
  title: 'Root Decision',
  status: 'open' as const,
  confidence: 'medium' as const,
  summary: 'Root summary',
  conclusion: null,
  rationale: null,
  createdAt: '2026-03-30T00:00:00.000Z',
  updatedAt: '2026-03-30T00:00:00.000Z',
}

const messages = [
  {
    id: 'm1',
    authorUserId: 'u1',
    nodeId: 'n1',
    turnId: 't0',
    role: 'system' as const,
    content: 'system',
    metadata: {},
    createdAt: '2026-03-30T00:00:00.000Z',
  },
  {
    id: 'm2',
    authorUserId: 'u1',
    nodeId: 'n1',
    turnId: 't1',
    role: 'user' as const,
    content: 'hello',
    metadata: {},
    createdAt: '2026-03-30T00:01:00.000Z',
  },
  {
    id: 'm3',
    authorUserId: 'u1',
    nodeId: 'n1',
    turnId: 't0',
    role: 'assistant' as const,
    content: 'hi',
    metadata: {},
    createdAt: '2026-03-30T00:02:00.000Z',
  },
]

describe('buildConversationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getNodeByIdForAuthorMock.mockResolvedValue(nodeRecord)
    listMessagesForNodeForAuthorMock.mockResolvedValue(messages)
  })

  test('builds context with bounded recent messages and node summary fields', async () => {
    const result = await buildConversationContext({
      nodeId: 'n1',
      currentUserId: 'u1',
      userInput: 'new question',
      recentMessageLimit: 2,
    })

    expect(result.node).toEqual({
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
    })
    expect(result.recentMessages).toEqual([
      {
        id: 'm2',
        role: 'user',
        content: 'hello',
        createdAt: '2026-03-30T00:01:00.000Z',
      },
      {
        id: 'm3',
        role: 'assistant',
        content: 'hi',
        createdAt: '2026-03-30T00:02:00.000Z',
      },
    ])
    expect(result.userInput).toBe('new question')
  })

  test('falls back to default message limit when provided limit is invalid', async () => {
    const manyMessages = Array.from({ length: DEFAULT_RECENT_MESSAGE_LIMIT + 5 }, (_, index) => ({
      id: `m-${index + 1}`,
      authorUserId: 'u1',
      nodeId: 'n1',
      turnId: `t-${index + 1}`,
      role: 'user' as const,
      content: `msg ${index + 1}`,
      metadata: {},
      createdAt: `2026-03-30T00:${String(index).padStart(2, '0')}:00.000Z`,
    }))
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce(manyMessages)

    const result = await buildConversationContext({
      nodeId: 'n1',
      currentUserId: 'u1',
      userInput: 'new question',
      recentMessageLimit: 0,
    })

    expect(result.recentMessages).toHaveLength(DEFAULT_RECENT_MESSAGE_LIMIT)
    expect(result.recentMessages[0]?.id).toBe('m-6')
    expect(result.recentMessages[result.recentMessages.length - 1]?.id).toBe(
      `m-${manyMessages.length}`,
    )
  })

  test('excludes the current turn from recent messages when provided', async () => {
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      {
        id: 'm-old',
        authorUserId: 'u1',
        nodeId: 'n1',
        turnId: 't-old',
        role: 'user' as const,
        content: 'old',
        metadata: {},
        createdAt: '2026-03-30T00:00:00.000Z',
      },
      {
        id: 'm-current',
        authorUserId: 'u1',
        nodeId: 'n1',
        turnId: 't-current',
        role: 'user' as const,
        content: 'current',
        metadata: {},
        createdAt: '2026-03-30T00:01:00.000Z',
      },
      {
        id: 'm-after',
        authorUserId: 'u1',
        nodeId: 'n1',
        turnId: 't-after',
        role: 'assistant' as const,
        content: 'after',
        metadata: {},
        createdAt: '2026-03-30T00:02:00.000Z',
      },
    ])

    const result = await buildConversationContext({
      nodeId: 'n1',
      currentUserId: 'u1',
      userInput: 'new question',
      currentTurnId: 't-current',
      recentMessageLimit: 10,
    })

    expect(result.recentMessages).toEqual([
      {
        id: 'm-old',
        role: 'user',
        content: 'old',
        createdAt: '2026-03-30T00:00:00.000Z',
      },
      {
        id: 'm-after',
        role: 'assistant',
        content: 'after',
        createdAt: '2026-03-30T00:02:00.000Z',
      },
    ])
  })

  test('throws NOT_FOUND when node is not accessible', async () => {
    getNodeByIdForAuthorMock.mockResolvedValueOnce(null)

    await expect(
      buildConversationContext({
        nodeId: 'missing-node',
        currentUserId: 'u1',
        userInput: 'new question',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  })
})
