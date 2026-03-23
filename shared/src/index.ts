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
  summary: z.string().nullable(),
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

const updateWorkspaceInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
})

const deleteWorkspaceInputSchema = z.object({
  id: z.string(),
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

const updateNodeInputSchema = z
  .object({
    id: z.string(),
    type: z.enum(['decision', 'question', 'option', 'constraint']).optional(),
    title: z.string().min(1).optional(),
    status: z.enum(['open', 'exploring', 'needs_approval', 'approved', 'deferred', 'closed']).optional(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    summary: z.string().optional(),
    conclusion: z.string().nullable().optional(),
    rationale: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.type !== undefined ||
      value.title !== undefined ||
      value.status !== undefined ||
      value.confidence !== undefined ||
      value.summary !== undefined ||
      value.conclusion !== undefined ||
      value.rationale !== undefined,
    { message: 'At least one node field must be provided for update.' },
  )

const deleteNodeInputSchema = z.object({
  id: z.string(),
})

const createMessageInputSchema = z.object({
  authorUserId: z.string(),
  nodeId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
})

const updateMessageInputSchema = z
  .object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']).optional(),
    content: z.string().optional(),
  })
  .refine(
    (value) => value.role !== undefined || value.content !== undefined,
    { message: 'At least one message field must be provided for update.' },
  )

const deleteMessageInputSchema = z.object({
  id: z.string(),
})

type User = z.infer<typeof userSchema>
type Workspace = z.infer<typeof workspaceSchema>
type Node = z.infer<typeof nodeSchema>
type Message = z.infer<typeof messageSchema>
type CreateUserInput = z.infer<typeof createUserInputSchema>
type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>
type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>
type CreateNodeInput = z.infer<typeof createNodeInputSchema>
type UpdateNodeInput = z.infer<typeof updateNodeInputSchema>
type CreateMessageInput = z.infer<typeof createMessageInputSchema>
type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>

export type AppRouterContext = {
  listUsers: () => Promise<User[]>
  getUserById: (id: string) => Promise<User | null>
  createUser: (input: CreateUserInput) => Promise<User>
  listWorkspaces: () => Promise<Workspace[]>
  getWorkspaceById: (id: string) => Promise<Workspace | null>
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>
  updateWorkspace: (
    input: UpdateWorkspaceInput,
  ) => Promise<Workspace | null>
  deleteWorkspace: (
    id: string,
  ) => Promise<{
    id: string
    deletedNodeCount: number
    deletedMessageCount: number
  } | null>
  listNodesByWorkspace: (workspaceId: string) => Promise<Node[]>
  getNodeById: (id: string) => Promise<Node | null>
  createNode: (input: CreateNodeInput) => Promise<Node>
  updateNode: (input: UpdateNodeInput) => Promise<Node | null>
  deleteNode: (
    id: string,
  ) => Promise<{
    id: string
    deletedWorkspace: boolean
    deletedNodeCount: number
    deletedMessageCount: number
  } | null>
  listMessagesForNode: (nodeId: string) => Promise<Message[]>
  createMessage: (input: CreateMessageInput) => Promise<Message>
  updateMessage: (input: UpdateMessageInput) => Promise<Message | null>
  deleteMessage: (id: string) => Promise<{ id: string } | null>
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
  workspaceUpdate: t.procedure
    .input(updateWorkspaceInputSchema)
    .mutation(({ ctx, input }) => ctx.updateWorkspace(input)),
  workspaceDelete: t.procedure
    .input(deleteWorkspaceInputSchema)
    .mutation(({ ctx, input }) => ctx.deleteWorkspace(input.id)),

  nodesByWorkspace: t.procedure
    .input(z.object({ workspaceId: z.string() }))
    .query(({ ctx, input }) => ctx.listNodesByWorkspace(input.workspaceId)),
  nodeById: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.getNodeById(input.id)),
  nodeCreate: t.procedure
    .input(createNodeInputSchema)
    .mutation(({ ctx, input }) => ctx.createNode(input)),
  nodeUpdate: t.procedure
    .input(updateNodeInputSchema)
    .mutation(({ ctx, input }) => ctx.updateNode(input)),
  nodeDelete: t.procedure
    .input(deleteNodeInputSchema)
    .mutation(({ ctx, input }) => ctx.deleteNode(input.id)),

  messagesByNode: t.procedure
    .input(z.object({ nodeId: z.string() }))
    .query(({ ctx, input }) => ctx.listMessagesForNode(input.nodeId)),
  messageCreate: t.procedure
    .input(createMessageInputSchema)
    .mutation(({ ctx, input }) => ctx.createMessage(input)),
  messageUpdate: t.procedure
    .input(updateMessageInputSchema)
    .mutation(({ ctx, input }) => ctx.updateMessage(input)),
  messageDelete: t.procedure
    .input(deleteMessageInputSchema)
    .mutation(({ ctx, input }) => ctx.deleteMessage(input.id)),
})

export type AppRouter = typeof appRouter
