import { z } from 'zod'

export const citationSchema = z.object({
  messageId: z.string().min(1),
  nodeId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative().optional(),
  excerpt: z.string().min(1).optional(),
  score: z.number().finite().optional(),
  sourceLabel: z.string().min(1).optional(),
}).passthrough()

export const retrievedChunkSchema = z.object({
  messageId: z.string().min(1),
  nodeId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  tokenCount: z.number().int().nonnegative().optional(),
  score: z.number().finite().optional(),
}).passthrough()

export const retrieverDiagnosticsSchema = z.object({
  retriever: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  totalChunks: z.number().int().nonnegative().optional(),
  selectedChunks: z.number().int().nonnegative().optional(),
  fallbackReason: z.string().min(1).optional(),
}).passthrough()

export const retrieverResultSchema = z.object({
  chunks: z.array(retrievedChunkSchema).default([]),
  diagnostics: retrieverDiagnosticsSchema.optional(),
}).passthrough()

export const contextSnapshotSchema = z.object({
  id: z.string().min(1).optional(),
  chunks: z.array(retrievedChunkSchema).default([]),
  totalTokenCount: z.number().int().nonnegative().optional(),
  createdAt: z.iso.datetime().optional(),
}).passthrough()

export const messageMetadataSchema = z.object({
  citations: z.array(citationSchema).optional(),
}).passthrough()

export const conversationTurnMetadataSchema = z.object({
  contextSnapshotId: z.string().min(1).optional(),
  contextSnapshot: contextSnapshotSchema.optional(),
  retrievalDiagnostics: retrieverDiagnosticsSchema.optional(),
}).passthrough()

export type Citation = z.infer<typeof citationSchema>
export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>
export type RetrieverDiagnostics = z.infer<typeof retrieverDiagnosticsSchema>
export type RetrieverResult = z.infer<typeof retrieverResultSchema>
export type ContextSnapshot = z.infer<typeof contextSnapshotSchema>
export type MessageMetadata = z.infer<typeof messageMetadataSchema>
export type ConversationTurnMetadata = z.infer<typeof conversationTurnMetadataSchema>

const normalizeMessageMetadataInput = (value: unknown): unknown =>
  value === null || value === undefined ? {} : value

export const parseMessageMetadata = (value: unknown): MessageMetadata => {
  const parsed = messageMetadataSchema.safeParse(normalizeMessageMetadataInput(value))
  return parsed.success ? parsed.data : {}
}

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
