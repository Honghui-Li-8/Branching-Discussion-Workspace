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

export const mergeProposalMetadataSchema = z.looseObject({
  eventType: z.literal('merge_proposal'),
  proposalId: z.string().min(1),
  proposedConclusion: z.string().trim().min(1),
  mergeStatus: z.enum(['pending', 'approved', 'superseded', 'cancelled']),
  revisionRound: z.number().int().positive(),
})

export const mergeEventMetadataSchema = z.looseObject({
  eventType: z.literal('merge_event'),
  sourceNodeId: z.string().min(1),
  sourceBranchTitle: z.string().min(1),
  sourceBranchOriginMessageId: z.string().min(1),
  conclusion: z.string().trim().min(1),
  mergedAt: z.iso.datetime(),
})

export const messageMetadataSchema = z.looseObject({
  citations: z.array(citationSchema).optional(),
  eventType: z.enum(['branch_event', 'merge_proposal', 'merge_event']).optional(),
  sourceNodeId: z.string().min(1).optional(),
  sourceMessageId: z.string().min(1).optional(),
  sourceAnnotationId: z.string().min(1).optional(),
  sourceContext: z.string().optional(),
  branchNodeId: z.string().min(1).optional(),
  proposalId: z.string().min(1).optional(),
  proposedConclusion: z.string().trim().min(1).optional(),
  mergeStatus: z.enum(['pending', 'approved', 'superseded', 'cancelled']).optional(),
  revisionRound: z.number().int().positive().optional(),
  sourceBranchTitle: z.string().min(1).optional(),
  sourceBranchOriginMessageId: z.string().min(1).optional(),
  conclusion: z.string().trim().min(1).optional(),
  mergedAt: z.iso.datetime().optional(),
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
export type MergeProposalMetadata = z.infer<typeof mergeProposalMetadataSchema>
export type MergeEventMetadata = z.infer<typeof mergeEventMetadataSchema>
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

export const parseMergeProposalMetadata = (
  value: unknown,
): MergeProposalMetadata | null => {
  const parsed = mergeProposalMetadataSchema.safeParse(normalizeMessageMetadataInput(value))
  return parsed.success ? parsed.data : null
}

export const parseMergeEventMetadata = (value: unknown): MergeEventMetadata | null => {
  const parsed = mergeEventMetadataSchema.safeParse(normalizeMessageMetadataInput(value))
  return parsed.success ? parsed.data : null
}

export const serializeBranchEventMetadata = (value: BranchEventMetadata): BranchEventMetadata =>
  branchEventMetadataSchema.parse(value)

export const serializeMergeProposalMetadata = (
  value: MergeProposalMetadata,
): MergeProposalMetadata => mergeProposalMetadataSchema.parse(value)

export const serializeMergeEventMetadata = (value: MergeEventMetadata): MergeEventMetadata =>
  mergeEventMetadataSchema.parse(value)

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
