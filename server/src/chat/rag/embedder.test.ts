import { describe, expect, jest, test } from '@jest/globals'
import { OpenAIEmbedder } from './embedder'

describe('OpenAIEmbedder', () => {
  test('throws when api key is missing', () => {
    expect(() => new OpenAIEmbedder({ apiKey: '' })).toThrow(
      'OPENAI_API_KEY is not configured.',
    )
  })

  test('returns empty embeddings for empty input', async () => {
    const fetchMock = jest.fn()
    const embedder = new OpenAIEmbedder({
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
    })

    await expect(embedder.embed([])).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('maps embeddings response into vectors', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2] },
          { embedding: [0.3, 0.4] },
        ],
      }),
    })) as unknown as typeof fetch

    const embedder = new OpenAIEmbedder({
      apiKey: 'test-key',
      model: 'text-embedding-3-small',
      fetchImpl: fetchMock,
    })

    await expect(embedder.embed(['a', 'b'])).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: ['a', 'b'],
        }),
      }),
    )
  })
})
