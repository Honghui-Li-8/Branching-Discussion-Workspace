import { TRPCError } from '@trpc/server'

const DEFAULT_ALLOWED_MODELS = ['gpt-5', 'gpt-4o', 'gpt-4.1', 'gpt-4']
const ALLOWED_MODELS_ENV = 'CHAT_ALLOWED_MODELS'

const normalizeModel = (value: string): string => value.trim().toLowerCase()

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
