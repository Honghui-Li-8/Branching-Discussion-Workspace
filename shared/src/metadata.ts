import { z } from 'zod'

const finiteNumberSchema = z
  .number()
  .refine((value) => Number.isFinite(value), 'Number must be finite.')

export const citationSchema = z.looseObject({
  messageId: z.string().min(1),
  nodeId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative().optional(),
  excerpt: z.string().min(1).optional(),
  score: finiteNumberSchema.optional(),
  sourceLabel: z.string().min(1).optional(),
})

export const retrieverInputSchema = z.looseObject({
  query: z.string().min(1),
  nodeId: z.string().min(1),
  authorUserId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  maxChunks: z.number().int().positive().optional(),
})

export const retrievedChunkSchema = z.looseObject({
  messageId: z.string().min(1),
  nodeId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  tokenCount: z.number().int().nonnegative().optional(),
  score: finiteNumberSchema.optional(),
})

export const retrieverDiagnosticsSchema = z.looseObject({
  retriever: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  totalChunks: z.number().int().nonnegative().optional(),
  selectedChunks: z.number().int().nonnegative().optional(),
  fallbackReason: z.string().min(1).optional(),
})

export const retrieverResultSchema = z.looseObject({
  chunks: z.array(retrievedChunkSchema).default([]),
  diagnostics: retrieverDiagnosticsSchema.optional(),
})

export const contextSnapshotSchema = z.looseObject({
  id: z.string().min(1).optional(),
  chunks: z.array(retrievedChunkSchema).default([]),
  totalTokenCount: z.number().int().nonnegative().optional(),
  createdAt: z.iso.datetime().optional(),
})

export const branchEventMetadataSchema = z.looseObject({
  eventType: z.literal('branch_event'),
  sourceNodeId: z.string().min(1),
  sourceMessageId: z.string().min(1),
  sourceAnnotationId: z.string().min(1).optional(),
  sourceContext: z.string().optional(),
  branchNodeId: z.string().min(1),
})

export const messageMetadataSchema = z.looseObject({
  citations: z.array(citationSchema).optional(),
  eventType: z.literal('branch_event').optional(),
  sourceNodeId: z.string().min(1).optional(),
  sourceMessageId: z.string().min(1).optional(),
  sourceAnnotationId: z.string().min(1).optional(),
  sourceContext: z.string().optional(),
  branchNodeId: z.string().min(1).optional(),
})

export const conversationTurnMetadataSchema = z.looseObject({
  contextSnapshotId: z.string().min(1).optional(),
  contextSnapshot: contextSnapshotSchema.optional(),
  retrievalDiagnostics: retrieverDiagnosticsSchema.optional(),
})

export type Citation = z.infer<typeof citationSchema>
export type RetrieverInput = z.infer<typeof retrieverInputSchema>
export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>
export type RetrieverDiagnostics = z.infer<typeof retrieverDiagnosticsSchema>
export type RetrieverResult = z.infer<typeof retrieverResultSchema>
export type ContextSnapshot = z.infer<typeof contextSnapshotSchema>
export type BranchEventMetadata = z.infer<typeof branchEventMetadataSchema>
export type MessageMetadata = z.infer<typeof messageMetadataSchema>
export type ConversationTurnMetadata = z.infer<typeof conversationTurnMetadataSchema>

const normalizeMessageMetadataInput = (value: unknown): unknown =>
  value === null || value === undefined ? {} : value

export const parseMessageMetadata = (value: unknown): MessageMetadata => {
  const parsed = messageMetadataSchema.safeParse(normalizeMessageMetadataInput(value))
  return parsed.success ? parsed.data : {}
}

export const parseBranchEventMetadata = (value: unknown): BranchEventMetadata | null => {
  const parsed = branchEventMetadataSchema.safeParse(normalizeMessageMetadataInput(value))
  return parsed.success ? parsed.data : null
}

export const serializeBranchEventMetadata = (value: BranchEventMetadata): BranchEventMetadata =>
  branchEventMetadataSchema.parse(value)

export const serializeMessageMetadata = (
  value: MessageMetadata | undefined,
): MessageMetadata => messageMetadataSchema.parse(normalizeMessageMetadataInput(value))

export const parseConversationTurnMetadata = (
  value: unknown,
): ConversationTurnMetadata => {
  const parsed = conversationTurnMetadataSchema.safeParse(
    normalizeMessageMetadataInput(value),
  )
  return parsed.success ? parsed.data : {}
}

export const serializeConversationTurnMetadata = (
  value: ConversationTurnMetadata | undefined,
): ConversationTurnMetadata =>
  conversationTurnMetadataSchema.parse(normalizeMessageMetadataInput(value))
