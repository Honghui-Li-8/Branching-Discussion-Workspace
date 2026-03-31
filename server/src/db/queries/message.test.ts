import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  createMessage,
  createMessageForAuthor,
  deleteMessageForAuthor,
  deleteMessage,
  getMessageByIdForAuthor,
  getMessageById,
  listMessagesForNodeForAuthor,
  listMessagesForNode,
  updateMessageForAuthor,
  updateMessage,
} from './message'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const messageRow = {
  id: 'm1',
  node_id: 'n1',
  author_user_id: 'u1',
  turn_id: 't1',
  role: 'user' as const,
  content: 'hello',
  metadata: {},
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
        turnId: 't1',
        role: 'user',
        content: 'hello',
        metadata: {},
        createdAt: '2026-03-17T00:00:00.000Z',
      },
    ])
  })

  test('listMessagesForNodeForAuthor returns rows for owner and empty for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [messageRow] } as never)
    const ownedResult = await listMessagesForNodeForAuthor('n1', 'u1')
    expect(ownedResult).toHaveLength(1)
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n1', 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await listMessagesForNodeForAuthor('n1', 'u2')
    expect(nonOwnerResult).toEqual([])
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n1', 'u2'],
    )
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
      ['n1', 'u1', 'user', 'hello', false, null, '{}'],
    )
  })

  test('createMessageForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [messageRow] } as never)
    const ownedResult = await createMessageForAuthor({
      authorUserId: 'u1',
      nodeId: 'n1',
      role: 'user',
      content: 'hello',
    })
    expect(ownedResult?.id).toBe('m1')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n1', 'u1', 'user', 'hello', false, null, '{}'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await createMessageForAuthor({
      authorUserId: 'u2',
      nodeId: 'n1',
      role: 'user',
      content: 'hello',
    })
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n1', 'u2', 'user', 'hello', false, null, '{}'],
    )
  })

  test('getMessageById returns null when not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await getMessageById('missing')

    expect(result).toBeNull()
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM messages'),
      ['missing'],
    )
  })

  test('getMessageByIdForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [messageRow] } as never)
    const ownedResult = await getMessageByIdForAuthor('m1', 'u1')
    expect(ownedResult?.id).toBe('m1')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['m1', 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await getMessageByIdForAuthor('m1', 'u2')
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['m1', 'u2'],
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
      ['m1', false, null, true, 'updated', false, null],
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

  test('updateMessageForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...messageRow, content: 'updated' }] } as never)
    const ownedResult = await updateMessageForAuthor(
      {
        id: 'm1',
        content: 'updated',
      },
      'u1',
    )
    expect(ownedResult?.content).toBe('updated')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('w.author_user_id = $8'),
      ['m1', false, null, true, 'updated', false, null, 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await updateMessageForAuthor(
      {
        id: 'm1',
        content: 'updated',
      },
      'u2',
    )
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('w.author_user_id = $8'),
      ['m1', false, null, true, 'updated', false, null, 'u2'],
    )
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

  test('deleteMessageForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'm1' }] } as never)
    const ownedResult = await deleteMessageForAuthor('m1', 'u1')
    expect(ownedResult).toEqual({ id: 'm1' })
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['m1', 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await deleteMessageForAuthor('m1', 'u2')
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['m1', 'u2'],
    )
  })
})
