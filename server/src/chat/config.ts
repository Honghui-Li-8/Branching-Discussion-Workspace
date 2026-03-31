import { TRPCError } from '@trpc/server'

const DEFAULT_ALLOWED_MODELS = ['gpt-5', 'gpt-4o', 'gpt-4.1', 'gpt-4']
const ALLOWED_MODELS_ENV = 'CHAT_ALLOWED_MODELS'
const RAG_ENABLED_ENV = 'RAG_ENABLED'
const RAG_RETRIEVER_ENV = 'RAG_RETRIEVER'
const RAG_EMBEDDING_MODEL_ENV = 'RAG_EMBEDDING_MODEL'
const RAG_MAX_CHUNKS_ENV = 'RAG_MAX_CHUNKS'
const RAG_MAX_RETRIEVAL_TOKENS_ENV = 'RAG_MAX_RETRIEVAL_TOKENS'
const RAG_SCORE_THRESHOLD_ENV = 'RAG_SCORE_THRESHOLD'
const RAG_ALLOWED_USER_IDS_ENV = 'RAG_ALLOWED_USER_IDS'
const RAG_ALLOWED_WORKSPACE_IDS_ENV = 'RAG_ALLOWED_WORKSPACE_IDS'

const DEFAULT_RAG_RETRIEVER = 'noop'
const DEFAULT_RAG_EMBEDDING_MODEL = 'text-embedding-3-small'
const DEFAULT_RAG_MAX_CHUNKS = 4
const DEFAULT_RAG_MAX_RETRIEVAL_TOKENS = 1200
const DEFAULT_RAG_SCORE_THRESHOLD = 0
const ALLOWED_RAG_RETRIEVERS = ['noop', 'vector_v1'] as const

const normalizeModel = (value: string): string => value.trim().toLowerCase()
const normalizeOptionalString = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const parseEnvList = (value: string | undefined): string[] => {
  if (!value || value.trim().length === 0) {
    return []
  }

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  )
}

const parseBooleanEnv = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
  const normalized = normalizeOptionalString(value)?.toLowerCase()
  if (!normalized) {
    return fallback
  }
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false
  }
  return fallback
}

const parseIntegerEnv = (
  value: string | undefined,
  fallback: number,
  minimum: number,
): number => {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return fallback
  }

  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}

const parseNumberEnv = (
  value: string | undefined,
  fallback: number,
  minimum: number,
): number => {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return fallback
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}

export type RagRetrieverStrategy = (typeof ALLOWED_RAG_RETRIEVERS)[number]

export interface RagConfig {
  enabled: boolean
  retriever: RagRetrieverStrategy
  embeddingModel: string
  maxChunks: number
  maxRetrievalTokens: number
  scoreThreshold: number
  allowedUserIds: string[]
  allowedWorkspaceIds: string[]
}

export const parseAllowedChatModels = (
  value: string | undefined,
): string[] => {
  if (!value || value.trim().length === 0) {
    return DEFAULT_ALLOWED_MODELS
  }

  const uniqueModels = Array.from(
    new Set(
      value
        .split(',')
        .map((item) => normalizeModel(item))
        .filter((item) => item.length > 0),
    ),
  )

  if (uniqueModels.length === 0) {
    return DEFAULT_ALLOWED_MODELS
  }

  return uniqueModels
}

export const getAllowedChatModels = (): string[] =>
  parseAllowedChatModels(process.env[ALLOWED_MODELS_ENV])

export const parseRagRetriever = (
  value: string | undefined,
): RagRetrieverStrategy => {
  const normalized = normalizeOptionalString(value)?.toLowerCase()
  if (!normalized) {
    return DEFAULT_RAG_RETRIEVER
  }

  return (ALLOWED_RAG_RETRIEVERS as readonly string[]).includes(normalized)
    ? normalized as RagRetrieverStrategy
    : DEFAULT_RAG_RETRIEVER
}

export const getRagConfig = (): RagConfig => ({
  enabled: parseBooleanEnv(process.env[RAG_ENABLED_ENV], false),
  retriever: parseRagRetriever(process.env[RAG_RETRIEVER_ENV]),
  embeddingModel:
    normalizeOptionalString(process.env[RAG_EMBEDDING_MODEL_ENV]) ??
    DEFAULT_RAG_EMBEDDING_MODEL,
  maxChunks: parseIntegerEnv(
    process.env[RAG_MAX_CHUNKS_ENV],
    DEFAULT_RAG_MAX_CHUNKS,
    1,
  ),
  maxRetrievalTokens: parseIntegerEnv(
    process.env[RAG_MAX_RETRIEVAL_TOKENS_ENV],
    DEFAULT_RAG_MAX_RETRIEVAL_TOKENS,
    1,
  ),
  scoreThreshold: parseNumberEnv(
    process.env[RAG_SCORE_THRESHOLD_ENV],
    DEFAULT_RAG_SCORE_THRESHOLD,
    0,
  ),
  allowedUserIds: parseEnvList(process.env[RAG_ALLOWED_USER_IDS_ENV]),
  allowedWorkspaceIds: parseEnvList(process.env[RAG_ALLOWED_WORKSPACE_IDS_ENV]),
})

export const isRagAllowedForTarget = ({
  config,
  userId,
  workspaceId,
}: {
  config: RagConfig
  userId?: string | null
  workspaceId?: string | null
}): boolean => {
  if (!config.enabled) {
    return false
  }

  if (config.allowedUserIds.length > 0) {
    return userId ? config.allowedUserIds.includes(userId) : false
  }

  if (config.allowedWorkspaceIds.length > 0) {
    return workspaceId ? config.allowedWorkspaceIds.includes(workspaceId) : false
  }

  return true
}

export const validateAllowedModelOrThrow = (model: string): void => {
  const normalizedModel = normalizeModel(model)
  const allowedModels = getAllowedChatModels()
  if (allowedModels.includes(normalizedModel)) {
    return
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Unsupported model "${model}". Allowed models: ${allowedModels.join(', ')}`,
  })
}

const isOpenAIModel = (model: string): boolean => normalizeModel(model).startsWith('gpt-')

export const validateProviderRuntimeConfigOrThrow = (model: string): void => {
  if (!isOpenAIModel(model)) {
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    return
  }

  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: `OPENAI_API_KEY is required for model "${model}".`,
  })
}
