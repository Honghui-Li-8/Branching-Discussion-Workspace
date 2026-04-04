import { describe, expect, jest, test } from '@jest/globals'
import { appRouter, type AppRouterContext } from '../index'

const fixedNow = '2026-03-17T00:00:00.000Z'

const makeContext = (): AppRouterContext => ({
  sessionUserId: 'u1',
  listUsers: jest.fn(async () => []),
  getUserById: jest.fn(async () => null),
  listWorkspaces: jest.fn(async () => []),
  getWorkspaceById: jest.fn(async () => null),
  createWorkspace: jest.fn(async () => ({
    id: 'w1',
    title: 'Workspace One',
    summary: null,
    authorUserId: 'u1',
    rootNodeId: 'n1',
    createdAt: fixedNow,
    updatedAt: fixedNow,
  })),
  updateWorkspace: jest.fn(async () => null),
  deleteWorkspace: jest.fn(async () => null),
  listNodesByWorkspace: jest.fn(async () => []),
  getNodeById: jest.fn(async () => null),
  createNode: jest.fn(async () => ({
    id: 'n1',
    workspaceId: 'w1',
    authorUserId: 'u1',
    parentNodeId: 'n1',
    depth: 0,
    type: 'decision' as const,
    title: 'Root',
    status: 'open' as const,
    confidence: 'medium' as const,
    summary: 'summary',
    conclusion: null,
    rationale: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  })),
  updateNode: jest.fn(async () => null),
  deleteNode: jest.fn(async () => null),
  listMessagesForNode: jest.fn(async () => []),
  createMessage: jest.fn(async () => ({
    id: 'm1',
    authorUserId: 'u1',
    nodeId: 'n1',
    role: 'user' as const,
    content: 'hello',
    createdAt: fixedNow,
  })),
  updateMessage: jest.fn(async () => null),
  deleteMessage: jest.fn(async () => null),
  listMessageAnnotationsByMessage: jest.fn(async () => []),
  messageBranchFromSelection: jest.fn(async () => ({
    annotation: {
      id: 'a1',
      messageId: 'm1',
      leadsToNodeId: 'n2',
      kind: 'branch' as const,
      quote: 'hello',
      selectorJson: {
        selector: [{ quote: 'hello', start: 0, end: 5 }],
      },
      createdByUserId: 'u1',
      createdAt: fixedNow,
      updatedAt: fixedNow,
    },
    branchNodeId: 'n2',
  })),
  conversationSend: jest.fn(async () => ({
    turnId: 't1',
    status: 'completed' as const,
    userMessage: {
      id: 'm1',
      authorUserId: 'u1',
      nodeId: 'n1',
      role: 'user' as const,
      content: 'hello',
      createdAt: fixedNow,
    },
    assistantMessage: null,
    error: null,
  })),
})

describe('shared public API router surface', () => {
  test('appRouter caller exposes V4 annotation procedures', () => {
    const caller = appRouter.createCaller(makeContext())

    expect(typeof caller.messageAnnotationsByMessage).toBe('function')
    expect(typeof caller.messageBranchFromSelection).toBe('function')
    expect(typeof caller.conversationSend).toBe('function')
  })
})
