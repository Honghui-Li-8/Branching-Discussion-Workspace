import { createLogger, type AppLogger } from '../../logging/logger.js'

type OpenAIEmbedderOptions = {
  apiKey?: string
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
}

type OpenAIEmbedderDeps = {
  logger?: AppLogger
}

type OpenAIEmbeddingsResponse = {
  data?: Array<{
    embedding?: number[]
  }>
}

const OPENAI_BASE_URL = 'https://api.openai.com'
const OPENAI_EMBEDDINGS_PATH = '/v1/embeddings'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'

export interface Embedder {
  readonly id: string
  embed: (texts: string[]) => Promise<number[][]>
}

export class OpenAIEmbedder implements Embedder {
  readonly id = 'openai'
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string
  private readonly fetchImpl: typeof fetch
  private readonly logger: AppLogger

  constructor(
    options: OpenAIEmbedderOptions = {},
    deps: OpenAIEmbedderDeps = {},
  ) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('OPENAI_API_KEY is not configured.')
    }

    this.apiKey = apiKey
    this.baseUrl = options.baseUrl ?? OPENAI_BASE_URL
    this.model = options.model ?? DEFAULT_EMBEDDING_MODEL
    this.fetchImpl = options.fetchImpl ?? fetch
    this.logger = deps.logger ?? createLogger('rag-embedder-openai')
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    const startedAtMs = Date.now()
    this.logger.debug('[rag] OpenAI embeddings request started.', {
      model: this.model,
      input_count: texts.length,
    })

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${OPENAI_EMBEDDINGS_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      })

      if (!response.ok) {
        const errorBody = typeof response.text === 'function'
          ? await response.text().catch(() => '')
          : ''
        this.logger.error('[rag] OpenAI embeddings request failed.', {
          model: this.model,
          status_code: response.status,
          response_body: errorBody.length > 500 ? `${errorBody.slice(0, 500)}...` : errorBody,
          input_count: texts.length,
          duration_ms: Date.now() - startedAtMs,
        })
        throw new Error(`OpenAI embeddings request failed (${response.status}).`)
      }

      const payload = (await response.json()) as OpenAIEmbeddingsResponse
      const embeddings = payload.data?.map((entry) => entry.embedding ?? []) ?? []
      if (embeddings.length !== texts.length) {
        throw new Error('OpenAI embeddings response length mismatch.')
      }

      this.logger.debug('[rag] OpenAI embeddings request completed.', {
        model: this.model,
        input_count: texts.length,
        duration_ms: Date.now() - startedAtMs,
      })
      return embeddings
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes('OpenAI embeddings request failed')
      ) {
        this.logger.error('[rag] OpenAI embeddings request failed.', {
          model: this.model,
          input_count: texts.length,
          duration_ms: Date.now() - startedAtMs,
          error,
        })
      }
      throw error
    }
  }
}
