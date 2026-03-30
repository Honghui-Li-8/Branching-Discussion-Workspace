import type { AssistantProvider } from './provider.js'
import { createOpenAIProvider } from './openaiProvider.js'
import { createPlaceholderProvider } from './placeholderProvider.js'

type SelectProviderOptions = {
  model: string
  apiKey?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
}

export const isOpenAIModel = (model: string): boolean =>
  model.trim().toLowerCase().startsWith('gpt-')

export const selectProvider = (
  options: SelectProviderOptions,
): AssistantProvider => {
  if (!isOpenAIModel(options.model)) {
    return createPlaceholderProvider()
  }

  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    return createPlaceholderProvider()
  }

  return createOpenAIProvider({
    apiKey,
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl,
  })
}
