import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  listMessageRetrievalChunksByMessageId,
  searchMessageRetrievalChunks,
  upsertMessageRetrievalChunk,
} from './messageRetrievalChunk'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const chunkRow = {
  id: 'chunk-1',
  message_id: 'm1',
  node_id: 'n1',
  author_user_id: 'u1',
  chunk_index: 0,
  content: 'hello world',
  token_count: 3,
  created_at: '2026-03-31T00:00:00.000Z',
  updated_at: '2026-03-31T00:00:00.000Z',
}

describe('message retrieval chunk queries', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  test('upsertMessageRetrievalChunk writes vector literal and maps row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [chunkRow] } as never)

    const result = await upsertMessageRetrievalChunk({
      messageId: 'm1',
      nodeId: 'n1',
      authorUserId: 'u1',
      chunkIndex: 0,
      content: 'hello world',
      tokenCount: 3,
      embedding: [0.1, 0.2],
    })

    expect(result).toEqual({
      id: 'chunk-1',
      messageId: 'm1',
      nodeId: 'n1',
      authorUserId: 'u1',
      chunkIndex: 0,
      content: 'hello world',
      tokenCount: 3,
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:00:00.000Z',
    })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (message_id, chunk_index)'),
      ['m1', 'n1', 'u1', 0, 'hello world', 3, '[0.1,0.2]'],
    )
  })

  test('listMessageRetrievalChunksByMessageId maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [chunkRow] } as never)

    const result = await listMessageRetrievalChunksByMessageId('m1')

    expect(result).toHaveLength(1)
    expect(result[0]?.messageId).toBe('m1')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM message_retrieval_chunk'),
      ['m1'],
    )
  })

  test('searchMessageRetrievalChunks scopes by node and author and maps score', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...chunkRow, score: 0.91 }],
    } as never)

    const result = await searchMessageRetrievalChunks({
      nodeId: 'n1',
      authorUserId: 'u1',
      embedding: [0.1, 0.2],
      limit: 5,
    })

    expect(result).toEqual([
      {
        id: 'chunk-1',
        messageId: 'm1',
        nodeId: 'n1',
        authorUserId: 'u1',
        chunkIndex: 0,
        content: 'hello world',
        tokenCount: 3,
        score: 0.91,
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
      },
    ])
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('1 - (embedding <=> $3::vector) AS score'),
      ['n1', 'u1', '[0.1,0.2]', 5],
    )
  })
})
