import type { AssistantProvider } from './provider.js'
import type {
  ConversationContext,
  GenerateAssistantInput,
  GenerateAssistantResult,
} from '../types.js'

type OpenAIProviderOptions = {
  apiKey?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
}

type OpenAIResponse = {
  id?: string
  output_text?: string
  finish_reason?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
}

const OPENAI_BASE_URL = 'https://api.openai.com'
const OPENAI_RESPONSES_PATH = '/v1/responses'

const mapFinishReason = (
  finishReason: string | undefined,
): GenerateAssistantResult['finishReason'] => {
  switch (finishReason) {
    case 'stop':
      return 'stop'
    case 'length':
      return 'length'
    case 'content_filter':
      return 'content_filter'
    default:
      return 'stop'
  }
}

const formatRecentMessages = (context: ConversationContext): string => {
  if (context.recentMessages.length === 0) {
    return 'No prior messages in this node.'
  }

  return context.recentMessages
    .map((message) => `[${message.role}] ${message.content}`)
    .join('\n')
}

const buildPrompt = (context: ConversationContext): string =>
  [
    `Node title: ${context.node.title}`,
    `Node summary: ${context.node.summary}`,
    `Node status: ${context.node.status}`,
    `Node confidence: ${context.node.confidence}`,
    `Recent messages:`,
    formatRecentMessages(context),
    `User input: ${context.userInput}`,
  ].join('\n')

const extractOutputText = (payload: OpenAIResponse): string => {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text
  }

  const outputParts = payload.output ?? []
  for (const part of outputParts) {
    const contentItems = part.content ?? []
    for (const item of contentItems) {
      if (item.type === 'output_text' && typeof item.text === 'string' && item.text.trim().length > 0) {
        return item.text
      }
    }
  }

  return ''
}

export const createOpenAIProvider = (
  options: OpenAIProviderOptions = {},
): AssistantProvider => {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  const baseUrl = options.baseUrl ?? OPENAI_BASE_URL
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    id: 'openai',
    generate: async (input: GenerateAssistantInput) => {
      const response = await fetchImpl(`${baseUrl}${OPENAI_RESPONSES_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          input: buildPrompt(input.context),
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI request failed (${response.status}).`)
      }

      const payload = (await response.json()) as OpenAIResponse
      const content = extractOutputText(payload)
      if (content.length === 0) {
        throw new Error('OpenAI response did not include output text.')
      }

      return {
        content,
        finishReason: mapFinishReason(payload.finish_reason),
        providerResponseId: payload.id ?? null,
      }
    },
  }
}
