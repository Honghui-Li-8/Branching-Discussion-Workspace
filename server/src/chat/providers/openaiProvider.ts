import type { AssistantProvider } from './provider.js'
import type {
  GenerateAssistantInput,
  GenerateAssistantResult,
} from '../types.js'
import { emitTokenDeltas } from './tokenDeltas.js'
import { createLogger, type AppLogger } from '../../logging/logger.js'
import type { RetrievedChunk } from '@branching/shared'

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

type OpenAIInputRole = 'system' | 'developer' | 'user' | 'assistant'

type OpenAIInputTextContent = {
  type: 'input_text'
  text: string
}

type OpenAIInputMessage = {
  type: 'message'
  role: OpenAIInputRole
  content: OpenAIInputTextContent[]
}

type OpenAIRequestBody = {
  model: string
  instructions: string
  input: OpenAIInputMessage[]
}

const OPENAI_BASE_URL = 'https://api.openai.com'
const OPENAI_RESPONSES_PATH = '/v1/responses'
const DEBUG_TEXT_PREVIEW_MAX_CHARS = 1_200

const toDebugPreview = (value: string): string =>
  value.length <= DEBUG_TEXT_PREVIEW_MAX_CHARS
    ? value
    : `${value.slice(0, DEBUG_TEXT_PREVIEW_MAX_CHARS)}...`

const formatRetrievedChunks = (chunks: RetrievedChunk[]): string =>
  chunks
    .map(
      (chunk, index) =>
        `[source ${index + 1} | message=${chunk.messageId} | chunk=${chunk.chunkIndex}] ${chunk.content}`,
    )
    .join('\n\n')

const toInputTextContent = (text: string): OpenAIInputTextContent[] => [
  {
    type: 'input_text',
    text,
  },
]

const buildOpenAIInputMessages = (
  prompt: GenerateAssistantInput['prompt'],
): OpenAIInputMessage[] => {
  const messages: OpenAIInputMessage[] = prompt.conversation.map((message) => ({
    type: 'message',
    role: message.role,
    content: toInputTextContent(message.content),
  }))

  if (prompt.retrievalContext.length > 0) {
    messages.push({
      type: 'message',
      role: 'developer',
      content: toInputTextContent(
        ['Retrieved context:', formatRetrievedChunks(prompt.retrievalContext)].join('\n'),
      ),
    })
  }

  messages.push({
    type: 'message',
    role: 'user',
    content: toInputTextContent(prompt.currentUserMessage),
  })

  return messages
}

const buildOpenAIRequestBody = (
  model: string,
  prompt: GenerateAssistantInput['prompt'],
): OpenAIRequestBody => ({
  model,
  instructions: prompt.instructions.join('\n'),
  input: buildOpenAIInputMessages(prompt),
})

const estimateRequestBodySize = (body: OpenAIRequestBody): number =>
  JSON.stringify(body).length

const countInputTextCharacters = (messages: OpenAIInputMessage[]): number =>
  messages.reduce(
    (total, message) =>
      total + message.content.reduce((contentTotal, item) => contentTotal + item.text.length, 0),
    0,
  )

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
      const requestBody = buildOpenAIRequestBody(input.model, input.prompt)
      logger.debug('[llm] OpenAI Responses request started.', {
        model: input.model,
        prompt_instruction_count: input.prompt.instructions.length,
        prompt_conversation_turn_count: input.prompt.conversation.length,
        prompt_retrieval_chunk_count: input.prompt.retrievalContext.length,
        prompt_instruction_length: requestBody.instructions.length,
        prompt_conversation_text_length: countInputTextCharacters(requestBody.input),
        prompt_current_user_message_length: input.prompt.currentUserMessage.length,
        prompt_current_user_message_preview: toDebugPreview(input.prompt.currentUserMessage),
        request_payload_size_bytes: estimateRequestBodySize(requestBody),
        request_input_message_count: requestBody.input.length,
      })
      const response = await fetchImpl(`${baseUrl}${OPENAI_RESPONSES_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
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
