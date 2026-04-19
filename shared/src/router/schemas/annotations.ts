import { z } from 'zod'
import { conversationTurnStatusSchema } from './conversation.js'

const nonEmptyTrimmedStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Value must not be empty.')

export type SelectorRange = {
  quote: string
  start: number
  end: number
}
export type SelectorJson = {
  selector: SelectorRange[]
}

export const assistantAnnotationKindSchema = z.enum([
  'suggestion',
  'branch',
  'suggestion-branch',
  'branch-origin',
])

const selectorRangeSchema = z
  .object({
    quote: nonEmptyTrimmedStringSchema,
    start: z.int().nonnegative(),
    end: z.int().nonnegative(),
  })
  .refine((value) => value.end > value.start, {
    message: 'Selector end must be greater than start.',
  })

export const annotationSelectorJsonSchema: z.ZodType<SelectorJson> = z.object({
  selector: z.array(selectorRangeSchema).min(1),
})

export const messageAnnotationSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  leadsToNodeId: z.string().nullable(),
  kind: assistantAnnotationKindSchema,
  quote: z.string(),
  startOffset: z.number().int().nonnegative().nullable().optional(),
  endOffset: z.number().int().nonnegative().nullable().optional(),
  selectorJson: annotationSelectorJsonSchema,
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
})

export const annotationSelectionInputSchema = z.object({
  quote: nonEmptyTrimmedStringSchema,
  selectorJson: annotationSelectorJsonSchema,
  startOffset: z.number().int().nonnegative().nullable().optional(),
  endOffset: z.number().int().nonnegative().nullable().optional(),
})

export const messageBranchNewNodeMetaSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  type: z.enum(['decision', 'question', 'option', 'constraint']).optional(),
})

export const messageAnnotationsByMessageInputSchema = z.object({
  messageId: z.string().uuid(),
})

export const messageSuggestFromSelectionInputSchema = z.object({
  messageId: z.string(),
  sourceAnnotationId: z.string().optional(),
  selection: annotationSelectionInputSchema,
  idempotencyKey: z.string().min(1),
})

export const messageAnnotationDeleteInputSchema = z.object({
  annotationId: nonEmptyTrimmedStringSchema,
})

export const messageAnnotationDeleteResultSchema = z.object({
  annotationId: z.string(),
  deletedBranchNodeId: z.string().nullable(),
  deletedNodeCount: z.number().int().nonnegative(),
  deletedMessageCount: z.number().int().nonnegative(),
})

export const messageBranchFromSelectionInputSchema = z
  .object({
    messageId: z.string(),
    sourceAnnotationId: z.string().optional(),
    selection: annotationSelectionInputSchema,
    annotationKind: z.enum(['branch', 'suggestion-branch']).optional(),
    newNodeMeta: messageBranchNewNodeMetaSchema.optional(),
    idempotencyKey: z.string().min(1),
  })
  .refine(
    (value) => value.annotationKind !== 'suggestion-branch' || Boolean(value.sourceAnnotationId),
    {
      message: 'sourceAnnotationId is required when annotationKind is suggestion-branch.',
      path: ['sourceAnnotationId'],
    },
  )

export const messageBranchFromSelectionResultSchema = z.object({
  annotation: messageAnnotationSchema,
  branchNodeId: z.string(),
})

export const branchAndSendFollowupInputSchema = z
  .object({
    messageId: z.string(),
    sourceAnnotationId: z.string().optional(),
    selection: annotationSelectionInputSchema,
    annotationKind: z.enum(['branch', 'suggestion-branch']).optional(),
    newNodeMeta: messageBranchNewNodeMetaSchema.optional(),
    text: z.string().min(1),
    model: z.string().min(1),
    idempotencyKey: z.string().min(1),
  })
  .refine(
    (value) => value.annotationKind !== 'suggestion-branch' || Boolean(value.sourceAnnotationId),
    {
      message: 'sourceAnnotationId is required when annotationKind is suggestion-branch.',
      path: ['sourceAnnotationId'],
    },
  )

export const branchAndSendFollowupResultSchema = z.object({
  branchNodeId: z.string(),
  annotationId: z.string(),
  branchEventMessageId: z.string().nullable(),
  userFollowupMessageId: z.string().nullable(),
  turnId: z.string(),
  status: conversationTurnStatusSchema,
})

export const branchFollowupStatusInputSchema = z.object({
  turnId: z.string().min(1),
})

export const branchFollowupStatusResultSchema = z.object({
  turnId: z.string(),
  status: conversationTurnStatusSchema,
  userFollowupMessageId: z.string().nullable(),
  error: z.string().nullable(),
})

export type MessageAnnotation = z.infer<typeof messageAnnotationSchema>
export type MessageAnnotationDeleteInput = z.infer<typeof messageAnnotationDeleteInputSchema>
export type MessageAnnotationDeleteResult = z.infer<typeof messageAnnotationDeleteResultSchema>
export type MessageSuggestFromSelectionInput = z.infer<typeof messageSuggestFromSelectionInputSchema>
export type MessageBranchFromSelectionInput = z.infer<typeof messageBranchFromSelectionInputSchema>
export type MessageBranchFromSelectionResult = z.infer<typeof messageBranchFromSelectionResultSchema>
export type BranchAndSendFollowupInput = z.infer<typeof branchAndSendFollowupInputSchema>
export type BranchAndSendFollowupResult = z.infer<typeof branchAndSendFollowupResultSchema>
export type BranchFollowupStatusInput = z.infer<typeof branchFollowupStatusInputSchema>
export type BranchFollowupStatusResult = z.infer<typeof branchFollowupStatusResultSchema>
