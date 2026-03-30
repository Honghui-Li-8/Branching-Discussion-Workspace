import { TRPCError, initTRPC } from '@trpc/server'
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

const createWorkspaceInputSchema = z.object({
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

const conversationTurnStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
])

const conversationSendInputSchema = z.object({
  nodeId: z.string(),
  text: z.string().min(1),
  model: z.string().min(1),
  idempotencyKey: z.string().min(1),
})

const conversationSendResultSchema = z.object({
  turnId: z.string(),
  status: conversationTurnStatusSchema,
  userMessage: messageSchema,
  assistantMessage: messageSchema.nullable(),
  error: z.string().nullable(),
})

type User = z.infer<typeof userSchema>
type Workspace = z.infer<typeof workspaceSchema>
type Node = z.infer<typeof nodeSchema>
type Message = z.infer<typeof messageSchema>
type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>
type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>
type CreateNodeInput = z.infer<typeof createNodeInputSchema>
type UpdateNodeInput = z.infer<typeof updateNodeInputSchema>
type CreateMessageInput = z.infer<typeof createMessageInputSchema>
type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>
type ConversationSendInput = z.infer<typeof conversationSendInputSchema>
type ConversationSendResult = z.infer<typeof conversationSendResultSchema>

export type AppRouterContext = {
  sessionUserId: string | null
  listUsers: () => Promise<User[]>
  getUserById: (id: string) => Promise<User | null>
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
  conversationSend: (
    input: ConversationSendInput,
  ) => Promise<ConversationSendResult>
}

const t = initTRPC.context<AppRouterContext>().create()
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.sessionUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    })
  }

  return next()
})

export const appRouter = t.router({
  health: t.procedure.query(() => ({
    status: 'ok',
    service: 'server',
    uptime: Math.floor(performance.now() / 1000),
  })),
  echo: t.procedure
    .input(z.string())
    .query(({ input }) => ({ message: `Hello, ${input}` })),

  usersList: protectedProcedure.query(({ ctx }) => ctx.listUsers()),
  userById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.getUserById(input.id)),

  workspacesList: protectedProcedure.query(({ ctx }) => ctx.listWorkspaces()),
  workspaceById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.getWorkspaceById(input.id)),
  workspaceCreate: protectedProcedure
    .input(createWorkspaceInputSchema)
    .mutation(({ ctx, input }) => ctx.createWorkspace(input)),
  workspaceUpdate: protectedProcedure
    .input(updateWorkspaceInputSchema)
    .mutation(({ ctx, input }) => ctx.updateWorkspace(input)),
  workspaceDelete: protectedProcedure
    .input(deleteWorkspaceInputSchema)
    .mutation(({ ctx, input }) => ctx.deleteWorkspace(input.id)),

  nodesByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(({ ctx, input }) => ctx.listNodesByWorkspace(input.workspaceId)),
  nodeById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.getNodeById(input.id)),
  nodeCreate: protectedProcedure
    .input(createNodeInputSchema)
    .mutation(({ ctx, input }) => ctx.createNode(input)),
  nodeUpdate: protectedProcedure
    .input(updateNodeInputSchema)
    .mutation(({ ctx, input }) => ctx.updateNode(input)),
  nodeDelete: protectedProcedure
    .input(deleteNodeInputSchema)
    .mutation(({ ctx, input }) => ctx.deleteNode(input.id)),

  messagesByNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .query(({ ctx, input }) => ctx.listMessagesForNode(input.nodeId)),
  messageCreate: protectedProcedure
    .input(createMessageInputSchema)
    .mutation(({ ctx, input }) => ctx.createMessage(input)),
  messageUpdate: protectedProcedure
    .input(updateMessageInputSchema)
    .mutation(({ ctx, input }) => ctx.updateMessage(input)),
  messageDelete: protectedProcedure
    .input(deleteMessageInputSchema)
    .mutation(({ ctx, input }) => ctx.deleteMessage(input.id)),
  conversationSend: protectedProcedure
    .input(conversationSendInputSchema)
    .mutation(({ ctx, input }) => ctx.conversationSend(input)),
})

export type AppRouter = typeof appRouter
