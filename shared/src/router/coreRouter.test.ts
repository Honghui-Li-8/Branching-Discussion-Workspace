import { describe, expect, jest, test } from '@jest/globals'
import { appRouter, type AppRouterContext } from '../index'

const fixedNow = '2026-03-17T00:00:00.000Z'

const makeContext = (): AppRouterContext => {
  const user = {
    id: 'u1',
    authUserId: 'auth-u1',
    email: 'u1@example.com',
    displayName: 'User One',
    creditBalance: 100,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  }

  const workspace = {
    id: 'w1',
    title: 'Workspace One',
    summary: 'Root summary',
    authorUserId: 'u1',
    rootNodeId: 'n1',
    createdAt: fixedNow,
    updatedAt: fixedNow,
  }

  const node = {
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
  }

  const message = {
    id: 'm1',
    authorUserId: 'u1',
    nodeId: 'n1',
    role: 'user' as const,
    content: 'hello',
    createdAt: fixedNow,
  }

  return {
    sessionUserId: 'u1',
    listUsers: jest.fn(async () => [user]),
    getUserById: jest.fn(async (id: string) => (id === user.id ? user : null)),
    listWorkspaces: jest.fn(async () => [workspace]),
    getWorkspaceById: jest.fn(async (id: string) => (id === workspace.id ? workspace : null)),
    createWorkspace: jest.fn(async () => workspace),
    updateWorkspace: jest.fn(async () => workspace),
    deleteWorkspace: jest.fn(async () => ({
      id: workspace.id,
      deletedNodeCount: 3,
      deletedMessageCount: 5,
    })),
    listNodesByWorkspace: jest.fn(async () => [node]),
    getNodeById: jest.fn(async (id: string) => (id === node.id ? node : null)),
    createNode: jest.fn(async () => node),
    updateNode: jest.fn(async () => node),
    deleteNode: jest.fn(async () => ({
      id: node.id,
      deletedWorkspace: false,
      deletedNodeCount: 2,
      deletedMessageCount: 4,
    })),
    listMessagesForNode: jest.fn(async () => [message]),
    createMessage: jest.fn(async () => message),
    updateMessage: jest.fn(async () => message),
    deleteMessage: jest.fn(async () => ({ id: message.id })),
    listMessageAnnotationsByMessage: jest.fn(async () => []),
    messageAnnotationDelete: jest.fn(async () => ({
      annotationId: 'a1',
      deletedBranchNodeId: 'n-child-1',
      deletedNodeCount: 1,
      deletedMessageCount: 0,
    })),
    messageBranchFromSelection: jest.fn(async () => ({
      annotation: {
        id: 'a1',
        messageId: message.id,
        leadsToNodeId: 'n-child-1',
        kind: 'branch' as const,
        quote: 'hello',
        selectorJson: {
          selector: [{ quote: 'hello', start: 0, end: 5 }],
        },
        createdByUserId: user.id,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      },
      branchNodeId: 'n-child-1',
    })),
    conversationSend: jest.fn(async () => ({
      turnId: 't1',
      status: 'completed' as const,
      userMessage: message,
      assistantMessage: {
        ...message,
        id: 'm2',
        role: 'assistant' as const,
        content: 'assistant reply',
      },
      error: null,
    })),
  }
}

describe('appRouter core routes', () => {
  test('health returns service status', async () => {
    const caller = appRouter.createCaller(makeContext())
    const result = await caller.health()

    expect(result.status).toBe('ok')
    expect(result.service).toBe('server')
    expect(typeof result.uptime).toBe('number')
  })

  test('workspaceCreate delegates to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const input = { title: 'Workspace One', rootNodeTitle: 'Root', rootNodeSummary: 'summary' }

    const result = await caller.workspaceCreate(input)

    expect(ctx.createWorkspace).toHaveBeenCalledWith(input)
    expect(result.id).toBe('w1')
  })

  test('protected core procedures require authenticated context', async () => {
    const caller = appRouter.createCaller({
      ...makeContext(),
      sessionUserId: null,
    })

    await expect(caller.usersList()).rejects.toThrow('Authentication required.')
    await expect(caller.userById({ id: 'u1' })).rejects.toThrow('Authentication required.')
    await expect(caller.workspacesList()).rejects.toThrow('Authentication required.')
    await expect(
      caller.conversationSend({
        nodeId: 'n1',
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
    ).rejects.toThrow('Authentication required.')
  })

  test('nodeCreate validates input', async () => {
    const caller = appRouter.createCaller(makeContext())

    await expect(
      caller.nodeCreate({
        workspaceId: 'w1',
        type: 'decision',
        title: 'Root',
        summary: 'summary',
      } as never),
    ).rejects.toThrow()
  })

  test('workspaceUpdate delegates to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const input = { id: 'w1', title: 'Workspace One (Updated)' }

    const result = await caller.workspaceUpdate(input)

    expect(ctx.updateWorkspace).toHaveBeenCalledWith(input)
    expect(result?.id).toBe('w1')
  })

  test('nodeUpdate delegates to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const input = { id: 'n1', summary: 'updated summary' }

    const result = await caller.nodeUpdate(input)

    expect(ctx.updateNode).toHaveBeenCalledWith(input)
    expect(result?.id).toBe('n1')
  })

  test('messageCreate delegates to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const input = { nodeId: 'n1', role: 'user' as const, content: 'hello' }

    const result = await caller.messageCreate(input)

    expect(ctx.createMessage).toHaveBeenCalledWith(input)
    expect(result.nodeId).toBe('n1')
  })

  test('messageUpdate validates patch payload', async () => {
    const caller = appRouter.createCaller(makeContext())
    await expect(caller.messageUpdate({ id: 'm1' } as never)).rejects.toThrow()
  })

  test('delete procedures delegate to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)

    await caller.workspaceDelete({ id: 'w1' })
    await caller.nodeDelete({ id: 'n1' })
    await caller.messageDelete({ id: 'm1' })

    expect(ctx.deleteWorkspace).toHaveBeenCalledWith('w1')
    expect(ctx.deleteNode).toHaveBeenCalledWith('n1')
    expect(ctx.deleteMessage).toHaveBeenCalledWith('m1')
  })

  test('conversationSend delegates to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const input = {
      nodeId: 'n1',
      text: 'hello',
      model: 'gpt-5',
      idempotencyKey: 'idempotency-key-1',
    }

    const result = await caller.conversationSend(input)

    expect(ctx.conversationSend).toHaveBeenCalledWith(input)
    expect(result.turnId).toBe('t1')
    expect(result.status).toBe('completed')
  })

  test('conversationSend validates required input fields', async () => {
    const caller = appRouter.createCaller(makeContext())

    await expect(
      caller.conversationSend({
        nodeId: 'n1',
        text: '',
        model: 'gpt-5',
        idempotencyKey: 'idempotency-key-1',
      }),
    ).rejects.toThrow()

    await expect(
      caller.conversationSend({
        nodeId: 'n1',
        text: 'hello',
        model: '',
        idempotencyKey: 'idempotency-key-1',
      }),
    ).rejects.toThrow()

    await expect(
      caller.conversationSend({
        nodeId: 'n1',
        text: 'hello',
        model: 'gpt-5',
        idempotencyKey: '',
      }),
    ).rejects.toThrow()
  })
})
