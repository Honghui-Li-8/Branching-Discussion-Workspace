import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const userSchema = z.object({
  id: z.string(),
  authUserId: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  creditBalance: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const workspaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  authorUserId: z.string(),
  rootNodeId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const nodeSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  authorUserId: z.string(),
  parentNodeId: z.string(),
  depth: z.number(),
  type: z.enum(['decision', 'question', 'option', 'constraint']),
  title: z.string(),
  status: z.enum(['open', 'exploring', 'needs_approval', 'approved', 'deferred', 'closed']),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string(),
  conclusion: z.string().nullable(),
  rationale: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const messageSchema = z.object({
  id: z.string(),
  authorUserId: z.string(),
  nodeId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
})

const createUserInputSchema = z.object({
  authUserId: z.string(),
  email: z.string().email().nullable().optional(),
  displayName: z.string().nullable().optional(),
})

const createWorkspaceInputSchema = z.object({
  authorUserId: z.string(),
  title: z.string(),
  rootNodeTitle: z.string().optional(),
  rootNodeSummary: z.string().optional(),
})

const createNodeInputSchema = z.object({
  workspaceId: z.string(),
  authorUserId: z.string(),
  parentNodeId: z.string(),
  type: z.enum(['decision', 'question', 'option', 'constraint']),
  title: z.string(),
  status: z.enum(['open', 'exploring', 'needs_approval', 'approved', 'deferred', 'closed']).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  summary: z.string(),
  conclusion: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
})

const createMessageInputSchema = z.object({
  authorUserId: z.string(),
  nodeId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
})

type User = z.infer<typeof userSchema>
type Workspace = z.infer<typeof workspaceSchema>
type Node = z.infer<typeof nodeSchema>
type Message = z.infer<typeof messageSchema>
type CreateUserInput = z.infer<typeof createUserInputSchema>
type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>
type CreateNodeInput = z.infer<typeof createNodeInputSchema>
type CreateMessageInput = z.infer<typeof createMessageInputSchema>

export type AppRouterContext = {
  listUsers: () => Promise<User[]>
  getUserById: (id: string) => Promise<User | null>
  createUser: (input: CreateUserInput) => Promise<User>
  listWorkspaces: () => Promise<Workspace[]>
  getWorkspaceById: (id: string) => Promise<Workspace | null>
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>
  listNodesByWorkspace: (workspaceId: string) => Promise<Node[]>
  getNodeById: (id: string) => Promise<Node | null>
  createNode: (input: CreateNodeInput) => Promise<Node>
  listMessagesForNode: (nodeId: string) => Promise<Message[]>
  createMessage: (input: CreateMessageInput) => Promise<Message>
}

const t = initTRPC.context<AppRouterContext>().create()

export const appRouter = t.router({
  health: t.procedure.query(() => ({
    status: 'ok',
    service: 'server',
    uptime: Math.floor(performance.now() / 1000),
  })),
  echo: t.procedure
    .input(z.string())
    .query(({ input }) => ({ message: `Hello, ${input}` })),

  usersList: t.procedure.query(({ ctx }) => ctx.listUsers()),
  userById: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.getUserById(input.id)),
  userCreate: t.procedure
    .input(createUserInputSchema)
    .mutation(({ ctx, input }) => ctx.createUser(input)),

  workspacesList: t.procedure.query(({ ctx }) => ctx.listWorkspaces()),
  workspaceById: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.getWorkspaceById(input.id)),
  workspaceCreate: t.procedure
    .input(createWorkspaceInputSchema)
    .mutation(({ ctx, input }) => ctx.createWorkspace(input)),

  nodesByWorkspace: t.procedure
    .input(z.object({ workspaceId: z.string() }))
    .query(({ ctx, input }) => ctx.listNodesByWorkspace(input.workspaceId)),
  nodeById: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.getNodeById(input.id)),
  nodeCreate: t.procedure
    .input(createNodeInputSchema)
    .mutation(({ ctx, input }) => ctx.createNode(input)),

  messagesByNode: t.procedure
    .input(z.object({ nodeId: z.string() }))
    .query(({ ctx, input }) => ctx.listMessagesForNode(input.nodeId)),
  messageCreate: t.procedure
    .input(createMessageInputSchema)
    .mutation(({ ctx, input }) => ctx.createMessage(input)),
})

export type AppRouter = typeof appRouter
