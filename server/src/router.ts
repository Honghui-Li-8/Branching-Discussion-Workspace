import { z } from 'zod'
import {
  createMessageInputSchema,
  createNodeInputSchema,
  createWorkspaceInputSchema,
  deleteMessageInputSchema,
  deleteNodeInputSchema,
  deleteWorkspaceInputSchema,
  exampleWorkspaceCreateInputSchema,
  inheritedMessagesByNodeInputSchema,
  parentMessagesUpToSourceInputSchema,
  updateMessageInputSchema,
  updateNodeInputSchema,
  updateWorkspaceInputSchema,
} from '@branching/shared/router/schemas/core'
import { createWorkspaceFromExample } from './db/queries/exampleWorkspaces.js'
import {
  branchAndSendFollowupInputSchema,
  branchAndSendFollowupResultSchema,
  branchFollowupStatusInputSchema,
  branchFollowupStatusResultSchema,
  messageAnnotationDeleteInputSchema,
  messageAnnotationDeleteResultSchema,
  messageAnnotationsByMessageInputSchema,
  messageBranchFromSelectionInputSchema,
  messageBranchFromSelectionResultSchema,
  messageSuggestFromSelectionInputSchema,
} from '@branching/shared/router/schemas/annotations'
import { conversationSendInputSchema } from '@branching/shared/router/schemas/conversation'
import {
  approveMergeInputSchema,
  approveMergeOutputSchema,
  cancelMergeInputSchema,
  cancelMergeOutputSchema,
  initiateNodeMergeInputSchema,
  initiateNodeMergeOutputSchema,
  reviseMergeProposalInputSchema,
  reviseMergeProposalOutputSchema,
} from '@branching/shared/router/schemas/merge'
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
  workspaceCreateFromExample: protectedProcedure
    .input(exampleWorkspaceCreateInputSchema)
    .mutation(({ ctx, input }) => createWorkspaceFromExample(input.key, ctx.sessionUserId!)),

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
  parentMessagesUpToSource: protectedProcedure
    .input(parentMessagesUpToSourceInputSchema)
    .query(({ ctx, input }) => ctx.listParentMessagesUpToSource(input)),
  inheritedMessagesByNode: protectedProcedure
    .input(inheritedMessagesByNodeInputSchema)
    .query(({ ctx, input }) => ctx.listInheritedMessagesForNode(input)),
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
  messageSuggestFromSelection: protectedProcedure
    .input(messageSuggestFromSelectionInputSchema)
    .mutation(({ ctx, input }) => ctx.messageSuggestFromSelection(input)),
  messageAnnotationDelete: protectedProcedure
    .input(messageAnnotationDeleteInputSchema)
    .output(messageAnnotationDeleteResultSchema)
    .mutation(({ ctx, input }) => ctx.messageAnnotationDelete(input)),
  messageBranchFromSelection: protectedProcedure
    .input(messageBranchFromSelectionInputSchema)
    .output(messageBranchFromSelectionResultSchema)
    .mutation(({ ctx, input }) => ctx.messageBranchFromSelection(input)),

  branchAndSendFollowup: protectedProcedure
    .input(branchAndSendFollowupInputSchema)
    .output(branchAndSendFollowupResultSchema)
    .mutation(({ ctx, input }) => ctx.branchAndSendFollowup(input)),
  branchFollowupStatus: protectedProcedure
    .input(branchFollowupStatusInputSchema)
    .output(branchFollowupStatusResultSchema.nullable())
    .query(({ ctx, input }) => ctx.branchFollowupStatus(input)),

  initiateNodeMerge: protectedProcedure
    .input(initiateNodeMergeInputSchema)
    .output(initiateNodeMergeOutputSchema)
    .mutation(({ ctx, input }) => ctx.initiateNodeMerge(input)),
  reviseMergeProposal: protectedProcedure
    .input(reviseMergeProposalInputSchema)
    .output(reviseMergeProposalOutputSchema)
    .mutation(({ ctx, input }) => ctx.reviseMergeProposal(input)),
  cancelMerge: protectedProcedure
    .input(cancelMergeInputSchema)
    .output(cancelMergeOutputSchema)
    .mutation(({ ctx, input }) => ctx.cancelMerge(input)),
  approveMerge: protectedProcedure
    .input(approveMergeInputSchema)
    .output(approveMergeOutputSchema)
    .mutation(({ ctx, input }) => ctx.approveMerge(input)),

  conversationSend: protectedProcedure
    .input(conversationSendInputSchema)
    .mutation(({ ctx, input }) => ctx.conversationSend(input)),
})

export type AppRouter = typeof appRouter
