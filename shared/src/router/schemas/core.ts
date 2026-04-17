import { z } from 'zod'
import { messageMetadataSchema } from '../../metadata.js'

export const userSchema = z.object({
  id: z.string(),
  authUserId: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  creditBalance: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const workspaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  authorUserId: z.string(),
  rootNodeId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const nodeSchema = z.object({
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

export const messageSchema = z.object({
  id: z.string(),
  authorUserId: z.string(),
  nodeId: z.string(),
  turnId: z.string().nullable().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  metadata: messageMetadataSchema.optional(),
  createdAt: z.string(),
})

export const createWorkspaceInputSchema = z.object({
  title: z.string(),
  rootNodeTitle: z.string().optional(),
  rootNodeSummary: z.string().optional(),
})

export const updateWorkspaceInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
})

export const deleteWorkspaceInputSchema = z.object({
  id: z.string(),
})

export const createNodeInputSchema = z.object({
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

export const updateNodeInputSchema = z
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

export const deleteNodeInputSchema = z.object({
  id: z.string(),
})

export const createMessageInputSchema = z.object({
  nodeId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
})

export const parentMessagesUpToSourceInputSchema = z.object({
  sourceNodeId: z.string(),
  sourceMessageId: z.string(),
})

export const inheritedMessagesByNodeInputSchema = z.object({
  nodeId: z.string(),
})

export const updateMessageInputSchema = z
  .object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']).optional(),
    content: z.string().optional(),
  })
  .refine(
    (value) => value.role !== undefined || value.content !== undefined,
    { message: 'At least one message field must be provided for update.' },
  )

export const deleteMessageInputSchema = z.object({
  id: z.string(),
})

export type User = z.infer<typeof userSchema>
export type Workspace = z.infer<typeof workspaceSchema>
export type Node = z.infer<typeof nodeSchema>
export type Message = z.infer<typeof messageSchema>
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>
export type CreateNodeInput = z.infer<typeof createNodeInputSchema>
export type UpdateNodeInput = z.infer<typeof updateNodeInputSchema>
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>
export type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>
export type ParentMessagesUpToSourceInput = z.infer<typeof parentMessagesUpToSourceInputSchema>
export type InheritedMessagesByNodeInput = z.infer<typeof inheritedMessagesByNodeInputSchema>
