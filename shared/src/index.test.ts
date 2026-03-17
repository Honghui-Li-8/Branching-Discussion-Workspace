import { appRouter, type AppRouterContext } from './index'

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
    listUsers: jest.fn(async () => [user]),
    getUserById: jest.fn(async (id: string) => (id === user.id ? user : null)),
    createUser: jest.fn(async () => user),
    listWorkspaces: jest.fn(async () => [workspace]),
    getWorkspaceById: jest.fn(async (id: string) => (id === workspace.id ? workspace : null)),
    createWorkspace: jest.fn(async () => workspace),
    listNodesByWorkspace: jest.fn(async () => [node]),
    getNodeById: jest.fn(async (id: string) => (id === node.id ? node : null)),
    createNode: jest.fn(async () => node),
    listMessagesForNode: jest.fn(async () => [message]),
    createMessage: jest.fn(async () => message),
  }
}

describe('appRouter', () => {
  test('health returns service status', async () => {
    const caller = appRouter.createCaller(makeContext())
    const result = await caller.health()

    expect(result.status).toBe('ok')
    expect(result.service).toBe('server')
    expect(typeof result.uptime).toBe('number')
  })

  test('userCreate delegates to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const input = { authUserId: 'auth-u1', email: 'u1@example.com', displayName: 'User One' }

    const result = await caller.userCreate(input)

    expect(ctx.createUser).toHaveBeenCalledWith(input)
    expect(result.authUserId).toBe('auth-u1')
  })

  test('workspaceCreate delegates to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const input = { authorUserId: 'u1', title: 'Workspace One', rootNodeTitle: 'Root', rootNodeSummary: 'summary' }

    const result = await caller.workspaceCreate(input)

    expect(ctx.createWorkspace).toHaveBeenCalledWith(input)
    expect(result.id).toBe('w1')
  })

  test('nodeCreate validates input', async () => {
    const caller = appRouter.createCaller(makeContext())

    await expect(
      caller.nodeCreate({
        workspaceId: 'w1',
        authorUserId: 'u1',
        type: 'decision',
        title: 'Root',
        summary: 'summary',
      } as never),
    ).rejects.toThrow()
  })

  test('messageCreate delegates to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const input = { authorUserId: 'u1', nodeId: 'n1', role: 'user' as const, content: 'hello' }

    const result = await caller.messageCreate(input)

    expect(ctx.createMessage).toHaveBeenCalledWith(input)
    expect(result.nodeId).toBe('n1')
  })
})
