import { z } from 'zod'
import {
  createMessageInputSchema,
  createNodeInputSchema,
  createWorkspaceInputSchema,
  deleteMessageInputSchema,
  deleteNodeInputSchema,
  deleteWorkspaceInputSchema,
  updateMessageInputSchema,
  updateNodeInputSchema,
  updateWorkspaceInputSchema,
} from './schemas/core.js'
import {
  messageAnnotationsByMessageInputSchema,
  messageBranchFromSelectionInputSchema,
  messageBranchFromSelectionResultSchema,
} from './schemas/annotations.js'
import { conversationSendInputSchema } from './schemas/conversation.js'
import { protectedProcedure, t } from './trpc.js'

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

  messageAnnotationsByMessage: protectedProcedure
    .input(messageAnnotationsByMessageInputSchema)
    .query(({ ctx, input }) => ctx.listMessageAnnotationsByMessage(input.messageId)),
  messageBranchFromSelection: protectedProcedure
    .input(messageBranchFromSelectionInputSchema)
    .output(messageBranchFromSelectionResultSchema)
    .mutation(({ ctx, input }) => ctx.messageBranchFromSelection(input)),

  conversationSend: protectedProcedure
    .input(conversationSendInputSchema)
    .mutation(({ ctx, input }) => ctx.conversationSend(input)),
})

export type AppRouter = typeof appRouter
