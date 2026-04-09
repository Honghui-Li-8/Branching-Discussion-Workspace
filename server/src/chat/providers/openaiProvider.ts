import type { AssistantProvider } from './provider.js'
import type {
  GenerateAssistantInput,
  GenerateAssistantResult,
} from '../types.js'
import { summarizePromptSections } from '../promptObservability.js'
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

type OpenAIOutputTextContent = {
  type: 'output_text'
  text: string
}

type OpenAIMessageContent = OpenAIInputTextContent | OpenAIOutputTextContent

type OpenAIInputMessage = {
  type: 'message'
  role: OpenAIInputRole
  content: OpenAIMessageContent[]
}

type OpenAIRetrievalContextPlaceholder = {
  type: 'temporary_retrieval_context_placeholder'
  chunkCount: number
  chunks: Array<{
    ordinal: number
    messageId: string
    nodeId: string
    chunkIndex: number
    tokenCount: number | null
    score: number | null
    content: string
  }>
}

type OpenAIRequestBody = {
  model: string
  instructions: string
  input: OpenAIInputMessage[]
  stream?: boolean
}

const OPENAI_BASE_URL = 'https://api.openai.com'
const OPENAI_RESPONSES_PATH = '/v1/responses'
const DEBUG_TEXT_PREVIEW_MAX_CHARS = 1_200

const toDebugPreview = (value: string): string =>
  value.length <= DEBUG_TEXT_PREVIEW_MAX_CHARS
    ? value
    : `${value.slice(0, DEBUG_TEXT_PREVIEW_MAX_CHARS)}...`

const buildRetrievalContextPlaceholder = (
  chunks: RetrievedChunk[],
): OpenAIRetrievalContextPlaceholder => ({
  // @todo, Temporary provider-level RAG shape: keep chunk boundaries and source metadata visible,
  // but this is still JSON-in-text at the API boundary. The final format should be a native
  // provider-side rendering, not a text-encoded placeholder.
  type: 'temporary_retrieval_context_placeholder',
  chunkCount: chunks.length,
  chunks: chunks.map((chunk, index) => ({
    ordinal: index + 1,
    messageId: chunk.messageId,
    nodeId: chunk.nodeId,
    chunkIndex: chunk.chunkIndex,
    tokenCount: chunk.tokenCount ?? null,
    score: chunk.score ?? null,
    content: chunk.content,
  })),
})

const toMessageContent = (
  role: OpenAIInputRole,
  text: string,
): OpenAIMessageContent[] => [
  {
    type: role === 'assistant' ? 'output_text' : 'input_text',
    text,
  },
]

const buildOpenAIInputMessages = (
  prompt: GenerateAssistantInput['prompt'],
  logger: AppLogger,
): OpenAIInputMessage[] => {
  const messages: OpenAIInputMessage[] = prompt.conversation.map((message) => ({
    type: 'message',
    role: message.role,
    content: toMessageContent(message.role, message.content),
  }))

  if (prompt.retrievalContext.length > 0) {
    const placeholder = buildRetrievalContextPlaceholder(prompt.retrievalContext)
    logger.warn('[llm] OpenAI retrieval context placeholder structure is in use.', {
      retrieval_context_count: placeholder.chunkCount,
      retrieval_context_chunk_ordinals: placeholder.chunks.map((chunk) => chunk.ordinal),
      retrieval_context_message_ids: placeholder.chunks.map((chunk) => chunk.messageId),
    })
    messages.push({
      type: 'message',
      role: 'developer',
      content: toMessageContent('developer', JSON.stringify(placeholder, null, 2)),
    })
  }

  messages.push({
    type: 'message',
    role: 'user',
    content: toMessageContent('user', prompt.currentUserMessage),
  })

  return messages
}

const buildOpenAIRequestBody = (
  model: string,
  prompt: GenerateAssistantInput['prompt'],
  logger: AppLogger,
  stream: boolean,
): OpenAIRequestBody => ({
  model,
  instructions: prompt.instructions.join('\n'),
  input: buildOpenAIInputMessages(prompt, logger),
  ...(stream ? { stream: true } : {}),
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

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const tryParseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as unknown
    return isObjectRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

const extractDeltaFromStreamEvent = (event: Record<string, unknown>): string | null => {
  if (event.type !== 'response.output_text.delta') {
    return null
  }

  return typeof event.delta === 'string' ? event.delta : null
}

const extractCompletedResponseFromStreamEvent = (
  event: Record<string, unknown>,
): OpenAIResponse | null => {
  if (event.type !== 'response.completed') {
    return null
  }

  const response = event.response
  return isObjectRecord(response) ? response as OpenAIResponse : null
}

const parseOpenAIResponseStream = async (
  body: ReadableStream<Uint8Array>,
  onTokenDelta: GenerateAssistantInput['onTokenDelta'],
): Promise<{ streamedContent: string; completedPayload: OpenAIResponse | null }> => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let bufferedText = ''
  let streamedContent = ''
  let completedPayload: OpenAIResponse | null = null
  let shouldStop = false

  const processSseFrame = async (frame: string): Promise<void> => {
    const lines = frame.split('\n')
    const dataLines: string[] = []
    for (const rawLine of lines) {
      const line = rawLine.trimEnd()
      if (!line || line.startsWith(':')) {
        continue
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart())
      }
    }

    if (dataLines.length === 0) {
      return
    }

    const data = dataLines.join('\n').trim()
    if (!data) {
      return
    }
    if (data === '[DONE]') {
      shouldStop = true
      return
    }

    const parsedEvent = tryParseJsonObject(data)
    if (!parsedEvent) {
      return
    }

    const delta = extractDeltaFromStreamEvent(parsedEvent)
    if (delta && delta.length > 0) {
      streamedContent += delta
      await onTokenDelta?.(delta)
      return
    }

    const completedResponse = extractCompletedResponseFromStreamEvent(parsedEvent)
    if (completedResponse) {
      completedPayload = completedResponse
    }
  }

  try {
    while (!shouldStop) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      bufferedText += decoder.decode(value, { stream: true })
      bufferedText = bufferedText.replace(/\r\n/g, '\n')
      while (true) {
        const separatorIndex = bufferedText.indexOf('\n\n')
        if (separatorIndex === -1) {
          break
        }

        const frame = bufferedText.slice(0, separatorIndex)
        bufferedText = bufferedText.slice(separatorIndex + 2)
        await processSseFrame(frame)
        if (shouldStop) {
          break
        }
      }
    }

    const flushed = decoder.decode()
    if (flushed) {
      bufferedText += flushed
    }
    if (!shouldStop && bufferedText.trim().length > 0) {
      await processSseFrame(bufferedText)
    }

    return { streamedContent, completedPayload }
  } finally {
    reader.releaseLock()
  }
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
      const shouldStream = typeof input.onTokenDelta === 'function'
      const requestBody = buildOpenAIRequestBody(
        input.model,
        input.prompt,
        logger,
        shouldStream,
      )
      const promptSections = summarizePromptSections(input.prompt)
      logger.debug('[llm] OpenAI Responses request started.', {
        model: input.model,
        prompt_sections: promptSections,
        prompt_instruction_length: requestBody.instructions.length,
        request_input_text_length: countInputTextCharacters(requestBody.input),
        prompt_retrieval_context_text_length: promptSections.retrievalContextTextLength,
        prompt_current_user_message_length: promptSections.currentUserMessageLength,
        prompt_current_user_message_preview: toDebugPreview(input.prompt.currentUserMessage),
        request_payload_size_bytes: estimateRequestBodySize(requestBody),
        request_input_message_count: requestBody.input.length,
      })
      logger.debug('[llm] OpenAI Responses raw request payload.', {
        model: input.model,
        request_body: requestBody,
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

      let payload: OpenAIResponse | null = null
      let content = ''

      if (shouldStream && response.body) {
        const streamResult = await parseOpenAIResponseStream(response.body, input.onTokenDelta)
        payload = streamResult.completedPayload
        if (payload) {
          content = extractOutputText(payload)
        }
        if (content.length === 0) {
          content = streamResult.streamedContent
        }
      } else {
        payload = (await response.json()) as OpenAIResponse
        content = extractOutputText(payload)
        await emitTokenDeltas(content, input.onTokenDelta)
      }

      if (content.length === 0) {
        throw new Error('OpenAI response did not include output text.')
      }
      if (!payload) {
        payload = {
          output_text: content,
          finish_reason: 'stop',
        }
      }

      logger.info('[llm] OpenAI Responses request completed.', {
        model: input.model,
        prompt_sections: promptSections,
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
        prompt_sections: promptSections,
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
