import { z } from 'zod'
import { createNodeInputSchema } from './core.js'

const finiteNumberSchema = z
  .number()
  .refine((value) => Number.isFinite(value), 'Number must be finite.')

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    finiteNumberSchema,
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

export const assistantAnnotationKindSchema = z.enum(['suggestion', 'branch', 'suggestion-branch'])

export const annotationSelectorJsonSchema = z.union([
  z.record(z.string(), jsonValueSchema),
  z.array(jsonValueSchema),
])

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
  quote: z
    .string()
    .refine((value) => value.trim().length > 0, 'Quote must not be empty.'),
  selectorJson: annotationSelectorJsonSchema,
  startOffset: z.number().int().nonnegative().nullable().optional(),
  endOffset: z.number().int().nonnegative().nullable().optional(),
})

export const messageAnnotationsByMessageInputSchema = z.object({
  messageId: z.string(),
})

export const messageBranchFromSelectionInputSchema = z
  .object({
    messageId: z.string(),
    selection: annotationSelectionInputSchema,
    targetNodeId: z.string().optional(),
    createNode: createNodeInputSchema.omit({ workspaceId: true }).optional(),
    idempotencyKey: z.string().min(1),
  })
  .refine(
    (value) =>
      (value.targetNodeId !== undefined ? 1 : 0) + (value.createNode !== undefined ? 1 : 0) ===
      1,
    { message: 'Provide exactly one of targetNodeId or createNode.' },
  )

export const messageBranchFromSelectionResultSchema = z.object({
  annotation: messageAnnotationSchema,
  branchNodeId: z.string(),
})

export type MessageAnnotation = z.infer<typeof messageAnnotationSchema>
export type MessageBranchFromSelectionInput = z.infer<typeof messageBranchFromSelectionInputSchema>
export type MessageBranchFromSelectionResult = z.infer<typeof messageBranchFromSelectionResultSchema>
