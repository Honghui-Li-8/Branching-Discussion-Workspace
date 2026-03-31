import type { AssistantProvider } from './provider.js'
import type {
  GenerateAssistantInput,
  GenerateAssistantResult,
} from '../types.js'
import { emitTokenDeltas } from './tokenDeltas.js'
import { createLogger, type AppLogger } from '../../logging/logger.js'

type OpenAIProviderOptions = {
  apiKey?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  logger?: AppLogger
}

type OpenAIResponse = {
  id?: string
  output_text?: string
  finish_reason?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
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
const DEBUG_TEXT_PREVIEW_MAX_CHARS = 1_200

const toDebugPreview = (value: string): string =>
  value.length <= DEBUG_TEXT_PREVIEW_MAX_CHARS
    ? value
    : `${value.slice(0, DEBUG_TEXT_PREVIEW_MAX_CHARS)}...`

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
  const logger = options.logger ?? createLogger('provider-openai')

  return {
    id: 'openai',
    generate: async (input: GenerateAssistantInput) => {
      const startedAtMs = Date.now()
      logger.debug('[llm] OpenAI Responses request started.', {
        model: input.model,
        prompt_input_length: input.prompt.input.length,
        prompt_user_input_length: input.prompt.userInput.length,
        prompt_input_preview: toDebugPreview(input.prompt.input),
        prompt_user_input_preview: toDebugPreview(input.prompt.userInput),
      })
      const response = await fetchImpl(`${baseUrl}${OPENAI_RESPONSES_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          input: input.prompt.input,
        }),
      })

      if (!response.ok) {
        const errorBody = typeof response.text === 'function'
          ? await response.text().catch(() => '')
          : ''
        logger.error('[llm] OpenAI Responses request failed.', {
          model: input.model,
          status_code: response.status,
          response_body: errorBody.length > 500 ? `${errorBody.slice(0, 500)}...` : errorBody,
          duration_ms: Date.now() - startedAtMs,
        })
        throw new Error(`OpenAI request failed (${response.status}).`)
      }

      const payload = (await response.json()) as OpenAIResponse
      const content = extractOutputText(payload)
      if (content.length === 0) {
        throw new Error('OpenAI response did not include output text.')
      }
      await emitTokenDeltas(content, input.onTokenDelta)

      logger.info('[llm] OpenAI Responses request completed.', {
        model: input.model,
        provider_response_id: payload.id ?? null,
        finish_reason: payload.finish_reason ?? null,
        input_tokens: payload.usage?.input_tokens ?? null,
        output_tokens: payload.usage?.output_tokens ?? null,
        total_tokens: payload.usage?.total_tokens ?? null,
        output_length: content.length,
        duration_ms: Date.now() - startedAtMs,
      })
      logger.debug('[llm] OpenAI Responses output preview.', {
        model: input.model,
        provider_response_id: payload.id ?? null,
        content_preview: toDebugPreview(content),
      })

      return {
        content,
        finishReason: mapFinishReason(payload.finish_reason),
        providerResponseId: payload.id ?? null,
      }
    },
  }
}
