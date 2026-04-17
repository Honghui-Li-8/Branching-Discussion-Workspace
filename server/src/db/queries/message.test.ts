import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  createMessage,
  createMessageForAuthor,
  deleteMessageForAuthor,
  deleteMessage,
  getBranchEventMetadataFromRecord,
  getMessageBranchSourceContextForAuthor,
  getMessageBranchSourceContextForAuthorInTransaction,
  getMessageByIdForAuthor,
  getMessageById,
  listMessagesByTurn,
  listMessagesForNodeForAuthor,
  listMessagesForNode,
  listParentMessagesUpToSource,
  listParentMessagesUpToSourceForAuthor,
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

  test('listMessagesByTurn returns rows for a turn in order', async () => {
    queryMock.mockResolvedValueOnce({ rows: [messageRow] } as never)

    const result = await listMessagesByTurn('t1')

    expect(result).toHaveLength(1)
    expect(result[0]?.turnId).toBe('t1')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE turn_id = $1'),
      ['t1'],
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

  test('getMessageBranchSourceContextForAuthor returns source context for owner', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ message_id: 'm1', parent_node_id: 'n1', workspace_id: 'w1' }],
    } as never)

    const result = await getMessageBranchSourceContextForAuthor('m1', 'u1')

    expect(result).toEqual({
      messageId: 'm1',
      parentNodeId: 'n1',
      workspaceId: 'w1',
    })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND w.author_user_id = $2'),
      ['m1', 'u1'],
    )
  })

  test('getMessageBranchSourceContextForAuthorInTransaction uses provided client query executor', async () => {
    const transactionQueryMock = jest.fn(async (_sql: string, _params: unknown[]) => ({
      rows: [{ message_id: 'm1', parent_node_id: 'n1', workspace_id: 'w1' }],
    }))

    const result = await getMessageBranchSourceContextForAuthorInTransaction(
      {
        query: transactionQueryMock,
      } as never,
      'm1',
      'u1',
    )

    expect(result).toEqual({
      messageId: 'm1',
      parentNodeId: 'n1',
      workspaceId: 'w1',
    })
    expect(transactionQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM messages m'),
      ['m1', 'u1'],
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

  describe('listParentMessagesUpToSource', () => {
    const parentRow1 = { ...messageRow, id: 'pm1', node_id: 'parent-node', created_at: '2026-03-17T00:00:01.000Z' }
    const parentRow2 = { ...messageRow, id: 'pm2', node_id: 'parent-node', created_at: '2026-03-17T00:00:02.000Z' }
    const sourceRow  = { ...messageRow, id: 'pm3', node_id: 'parent-node', created_at: '2026-03-17T00:00:03.000Z' }

    test('returns messages in ascending order up to and including source', async () => {
      queryMock.mockResolvedValueOnce({ rows: [parentRow1, parentRow2, sourceRow] } as never)

      const result = await listParentMessagesUpToSource('parent-node', 'pm3')

      expect(result).toHaveLength(3)
      expect(result[0]?.id).toBe('pm1')
      expect(result[2]?.id).toBe('pm3')
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY m.created_at ASC, m.id ASC'),
        ['parent-node', 'pm3'],
      )
    })

    test('returns empty array when parent node has no messages', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] } as never)

      const result = await listParentMessagesUpToSource('parent-node', 'pm3')

      expect(result).toEqual([])
    })

    test('returns empty array when source message does not exist', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] } as never)

      const result = await listParentMessagesUpToSource('parent-node', 'nonexistent')

      expect(result).toEqual([])
    })

    test('returns empty array when source message is from a different node', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] } as never)

      const result = await listParentMessagesUpToSource('parent-node', 'msg-from-other-node')

      expect(result).toEqual([])
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('AND node_id = $1'),
        ['parent-node', 'msg-from-other-node'],
      )
    })

    test('includes source message at exact boundary', async () => {
      queryMock.mockResolvedValueOnce({ rows: [sourceRow] } as never)

      const result = await listParentMessagesUpToSource('parent-node', 'pm3')

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('pm3')
    })

    test('uses CTE with node binding and composite id tiebreak for boundary', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] } as never)

      await listParentMessagesUpToSource('parent-node', 'pm3')

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringMatching(/WITH source AS[\s\S]*WHERE id = \$2[\s\S]*AND node_id = \$1/),
        ['parent-node', 'pm3'],
      )
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('m.id <= source.id'),
        ['parent-node', 'pm3'],
      )
    })
  })

  describe('listParentMessagesUpToSourceForAuthor', () => {
    const parentRow = { ...messageRow, id: 'pm1', node_id: 'parent-node', created_at: '2026-03-17T00:00:01.000Z' }

    test('returns rows for owner', async () => {
      queryMock.mockResolvedValueOnce({ rows: [parentRow] } as never)

      const result = await listParentMessagesUpToSourceForAuthor('parent-node', 'pm1', 'u1')

      expect(result).toHaveLength(1)
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('AND w.author_user_id = $3'),
        ['parent-node', 'pm1', 'u1'],
      )
    })

    test('returns empty array for non-owner', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] } as never)

      const result = await listParentMessagesUpToSourceForAuthor('parent-node', 'pm1', 'u2')

      expect(result).toEqual([])
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('AND w.author_user_id = $3'),
        ['parent-node', 'pm1', 'u2'],
      )
    })

    test('CTE binds source message to sourceNodeId in author-scoped variant', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] } as never)

      await listParentMessagesUpToSourceForAuthor('parent-node', 'pm1', 'u1')

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringMatching(/WITH source AS[\s\S]*WHERE id = \$2[\s\S]*AND node_id = \$1/),
        ['parent-node', 'pm1', 'u1'],
      )
    })
  })

  describe('getBranchEventMetadataFromRecord', () => {
    const baseRecord = {
      id: 'm1',
      authorUserId: 'u1',
      nodeId: 'n1',
      turnId: null,
      content: 'hello',
      createdAt: '2026-03-17T00:00:00.000Z',
    }

    test('returns branch event metadata when record has valid branch event metadata', () => {
      const record = {
        ...baseRecord,
        role: 'user' as const,
        metadata: {
          eventType: 'branch_event' as const,
          sourceNodeId: 'node-1',
          sourceMessageId: 'msg-1',
          branchNodeId: 'branch-node-1',
        },
      }

      const result = getBranchEventMetadataFromRecord(record)

      expect(result).toEqual({
        eventType: 'branch_event',
        sourceNodeId: 'node-1',
        sourceMessageId: 'msg-1',
        branchNodeId: 'branch-node-1',
      })
    })

    test('returns null for a regular user message', () => {
      const record = { ...baseRecord, role: 'user' as const, metadata: {} }

      expect(getBranchEventMetadataFromRecord(record)).toBeNull()
    })

    test('returns null for an assistant message', () => {
      const record = { ...baseRecord, role: 'assistant' as const, metadata: {} }

      expect(getBranchEventMetadataFromRecord(record)).toBeNull()
    })
  })
})
