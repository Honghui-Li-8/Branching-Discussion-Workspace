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
    expect(result.memoryPlaceholder).toEqual({
      status: 'pending',
      olderMessageCount: 1,
      retainedMessageCount: 2,
    })
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
    expect(result.memoryPlaceholder).toEqual({
      status: 'pending',
      olderMessageCount: 5,
      retainedMessageCount: DEFAULT_RECENT_MESSAGE_LIMIT,
    })
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
    expect(result.memoryPlaceholder).toBeNull()
  })

  test('does not create a memory placeholder when no older context is trimmed', async () => {
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      {
        id: 'm-only',
        authorUserId: 'u1',
        nodeId: 'n1',
        turnId: 't-current',
        role: 'user' as const,
        content: 'only',
        metadata: {},
        createdAt: '2026-03-30T00:00:00.000Z',
      },
    ])

    const result = await buildConversationContext({
      nodeId: 'n1',
      currentUserId: 'u1',
      userInput: 'new question',
      currentTurnId: 't-current',
      recentMessageLimit: 10,
    })

    expect(result.recentMessages).toEqual([])
    expect(result.memoryPlaceholder).toBeNull()
  })

  test('loads only current node history for child nodes and does not merge parent messages', async () => {
    getNodeByIdForAuthorMock.mockResolvedValueOnce({
      ...nodeRecord,
      id: 'n-child',
      parentNodeId: 'n-parent',
      depth: 1,
      title: 'Child Branch',
      summary: 'Child summary',
    })
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      {
        id: 'm-branch-event',
        authorUserId: 'u1',
        nodeId: 'n-child',
        turnId: null,
        role: 'user' as const,
        content: 'surrounding branch context',
        metadata: {
          eventType: 'branch_event' as const,
          sourceNodeId: 'n-parent',
          sourceMessageId: 'm-parent-source',
          branchNodeId: 'n-child',
        },
        createdAt: '2026-03-30T00:03:00.000Z',
      },
      {
        id: 'm-child-followup',
        authorUserId: 'u1',
        nodeId: 'n-child',
        turnId: 't-child-1',
        role: 'user' as const,
        content: 'follow-up question',
        metadata: {},
        createdAt: '2026-03-30T00:04:00.000Z',
      },
    ])

    const result = await buildConversationContext({
      nodeId: 'n-child',
      currentUserId: 'u1',
      userInput: 'next child turn',
      recentMessageLimit: 10,
    })

    expect(getNodeByIdForAuthorMock).toHaveBeenCalledWith('n-child', 'u1')
    expect(listMessagesForNodeForAuthorMock).toHaveBeenCalledWith('n-child', 'u1')
    expect(result.recentMessages).toEqual([
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
    expect(result.node.parentNodeId).toBe('n-parent')
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

describe('buildConversationContext — branch-node context assembly', () => {
  // Shared fixtures for a branch child node and its canonical message sequence.
  const childNodeRecord = {
    ...nodeRecord,
    id: 'n-child',
    parentNodeId: 'n-parent',
    depth: 1,
    title: 'Branch Child',
    summary: 'Child summary',
  }

  const branchEventMessage = {
    id: 'm-branch-event',
    authorUserId: 'u1',
    nodeId: 'n-child',
    turnId: null,
    role: 'user' as const,
    content: 'surrounding branch context',
    metadata: {
      eventType: 'branch_event' as const,
      sourceNodeId: 'n-parent',
      sourceMessageId: 'm-parent-source',
      sourceAnnotationId: 'a1',
      sourceContext: 'surrounding branch context',
      branchNodeId: 'n-child',
    },
    createdAt: '2026-04-01T00:00:00.000Z',
  }

  const followupUserMessage = {
    id: 'm-followup',
    authorUserId: 'u1',
    nodeId: 'n-child',
    turnId: 't-child-1',
    role: 'user' as const,
    content: 'What do you mean by this?',
    metadata: {},
    createdAt: '2026-04-01T00:01:00.000Z',
  }

  const assistantMessage = {
    id: 'm-assistant',
    authorUserId: 'u1',
    nodeId: 'n-child',
    turnId: 't-child-1',
    role: 'assistant' as const,
    content: 'I meant the following…',
    metadata: {},
    createdAt: '2026-04-01T00:02:00.000Z',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('includes branch event as first entry in the ordered message sequence: event → follow-up → assistant', async () => {
    // The branch event (turnId=null) is persisted before the turn pipeline runs, so it must
    // always be the first message in the child node's message list. Context assembly must
    // pass through the full ordered sequence without reordering or filtering any rows.
    getNodeByIdForAuthorMock.mockResolvedValueOnce(childNodeRecord)
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      branchEventMessage,
      followupUserMessage,
      assistantMessage,
    ])

    const result = await buildConversationContext({
      nodeId: 'n-child',
      currentUserId: 'u1',
      userInput: 'next question',
    })

    expect(result.recentMessages).toEqual([
      {
        id: 'm-branch-event',
        role: 'user',
        content: 'surrounding branch context',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'm-followup',
        role: 'user',
        content: 'What do you mean by this?',
        createdAt: '2026-04-01T00:01:00.000Z',
      },
      {
        id: 'm-assistant',
        role: 'assistant',
        content: 'I meant the following…',
        createdAt: '2026-04-01T00:02:00.000Z',
      },
    ])
    expect(result.memoryPlaceholder).toBeNull()
    expect(result.node.parentNodeId).toBe('n-parent')
  })

  test('retains branch event when currentTurnId filters the current turn's messages', async () => {
    // When building context for the first child turn, currentTurnId is set to exclude
    // in-flight messages. The branch event has turnId=null so it is never filtered out —
    // it must remain in the context as the sole carrier of parent-node history.
    getNodeByIdForAuthorMock.mockResolvedValueOnce(childNodeRecord)
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      branchEventMessage,
      followupUserMessage, // part of t-child-1 — should be excluded
    ])

    const result = await buildConversationContext({
      nodeId: 'n-child',
      currentUserId: 'u1',
      userInput: 'next question',
      currentTurnId: 't-child-1',
    })

    expect(result.recentMessages).toEqual([
      {
        id: 'm-branch-event',
        role: 'user',
        content: 'surrounding branch context',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ])
    // Only branch event remains — it has no turnId so the filter leaves it intact.
    expect(result.memoryPlaceholder).toBeNull()
  })

  test('counts branch event toward olderMessageCount when the context window trims it', async () => {
    // A tight recentMessageLimit can trim the branch event along with earlier turn messages.
    // The memory placeholder must account for it — the model must know history was truncated.
    const secondFollowup = {
      id: 'm-followup-2',
      authorUserId: 'u1',
      nodeId: 'n-child',
      turnId: 't-child-2',
      role: 'user' as const,
      content: 'A second follow-up.',
      metadata: {},
      createdAt: '2026-04-01T00:03:00.000Z',
    }

    getNodeByIdForAuthorMock.mockResolvedValueOnce(childNodeRecord)
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      branchEventMessage,   // trimmed
      followupUserMessage,  // trimmed
      assistantMessage,     // retained
      secondFollowup,       // retained
    ])

    const result = await buildConversationContext({
      nodeId: 'n-child',
      currentUserId: 'u1',
      userInput: 'next question',
      recentMessageLimit: 2,
    })

    expect(result.recentMessages).toHaveLength(2)
    expect(result.recentMessages[0]?.id).toBe('m-assistant')
    expect(result.recentMessages[1]?.id).toBe('m-followup-2')
    expect(result.memoryPlaceholder).toEqual({
      status: 'pending',
      olderMessageCount: 2, // branch event + first follow-up trimmed
      retainedMessageCount: 2,
    })
  })

  test('nested branch node loads only grandchild messages without issuing additional ancestor queries', async () => {
    // Each branch level is self-contained: the grandchild node holds its own branch event
    // (pointing at the child node as parent) plus its own turns. Context assembly must
    // query only the grandchild node — not the child or root — matching the MVP design
    // where inherited history is embedded in the branch event message content.
    const grandchildNodeRecord = {
      ...nodeRecord,
      id: 'n-grandchild',
      parentNodeId: 'n-child',
      depth: 2,
      title: 'Grandchild Branch',
      summary: 'Grandchild summary',
    }
    const grandchildBranchEvent = {
      id: 'm-gc-event',
      authorUserId: 'u1',
      nodeId: 'n-grandchild',
      turnId: null,
      role: 'user' as const,
      content: 'grandchild branch context',
      metadata: {
        eventType: 'branch_event' as const,
        sourceNodeId: 'n-child',
        sourceMessageId: 'm-child-source',
        sourceAnnotationId: 'a2',
        sourceContext: 'grandchild branch context',
        branchNodeId: 'n-grandchild',
      },
      createdAt: '2026-04-01T00:10:00.000Z',
    }
    const grandchildFollowup = {
      id: 'm-gc-followup',
      authorUserId: 'u1',
      nodeId: 'n-grandchild',
      turnId: 't-gc-1',
      role: 'user' as const,
      content: 'grandchild question',
      metadata: {},
      createdAt: '2026-04-01T00:11:00.000Z',
    }

    getNodeByIdForAuthorMock.mockResolvedValueOnce(grandchildNodeRecord)
    listMessagesForNodeForAuthorMock.mockResolvedValueOnce([
      grandchildBranchEvent,
      grandchildFollowup,
    ])

    const result = await buildConversationContext({
      nodeId: 'n-grandchild',
      currentUserId: 'u1',
      userInput: 'grandchild next turn',
    })

    // Only one node lookup and one message list query — no ancestor traversal.
    expect(getNodeByIdForAuthorMock).toHaveBeenCalledTimes(1)
    expect(getNodeByIdForAuthorMock).toHaveBeenCalledWith('n-grandchild', 'u1')
    expect(listMessagesForNodeForAuthorMock).toHaveBeenCalledTimes(1)
    expect(listMessagesForNodeForAuthorMock).toHaveBeenCalledWith('n-grandchild', 'u1')

    expect(result.recentMessages).toEqual([
      {
        id: 'm-gc-event',
        role: 'user',
        content: 'grandchild branch context',
        createdAt: '2026-04-01T00:10:00.000Z',
      },
      {
        id: 'm-gc-followup',
        role: 'user',
        content: 'grandchild question',
        createdAt: '2026-04-01T00:11:00.000Z',
      },
    ])
    expect(result.node.parentNodeId).toBe('n-child')
    expect(result.memoryPlaceholder).toBeNull()
  })
})
