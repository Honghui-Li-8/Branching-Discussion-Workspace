import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import { createMessage, deleteMessage, listMessagesForNode, updateMessage } from './message'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const messageRow = {
  id: 'm1',
  node_id: 'n1',
  author_user_id: 'u1',
  role: 'user' as const,
  content: 'hello',
  created_at: '2026-03-17T00:00:00.000Z',
}

describe('message queries', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  test('listMessagesForNode maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [messageRow] } as never)

    const result = await listMessagesForNode('n1')

    expect(result).toEqual([
      {
        id: 'm1',
        authorUserId: 'u1',
        nodeId: 'n1',
        role: 'user',
        content: 'hello',
        createdAt: '2026-03-17T00:00:00.000Z',
      },
    ])
  })

  test('createMessage requires an existing node', async () => {
    queryMock.mockResolvedValueOnce({ rows: [messageRow] } as never)

    const result = await createMessage({
      authorUserId: 'u1',
      nodeId: 'n1',
      role: 'user',
      content: 'hello',
    })

    expect(result.id).toBe('m1')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM nodes'),
      ['n1', 'u1', 'user', 'hello'],
    )
  })

  test('createMessage throws when node is missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    await expect(
      createMessage({
        authorUserId: 'u1',
        nodeId: 'missing',
        role: 'assistant',
        content: 'response',
      }),
    ).rejects.toThrow('Node not found')
  })

  test('updateMessage returns updated row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...messageRow, content: 'updated' }],
    } as never)

    const result = await updateMessage({
      id: 'm1',
      content: 'updated',
    })

    expect(result?.content).toBe('updated')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE messages'),
      ['m1', false, null, true, 'updated'],
    )
  })

  test('updateMessage returns null when missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await updateMessage({
      id: 'missing',
      role: 'system',
    })

    expect(result).toBeNull()
  })

  test('deleteMessage returns deleted id', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'm1' }] } as never)

    const result = await deleteMessage('m1')

    expect(result).toEqual({ id: 'm1' })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM messages'),
      ['m1'],
    )
  })
})
