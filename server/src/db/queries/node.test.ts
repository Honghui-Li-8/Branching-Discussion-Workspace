import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  createNode,
  createNodeForAuthor,
  createNodeForAuthorInTransaction,
  deleteNode,
  deleteNodeForAuthor,
  getNodeById,
  getNodeByIdForAuthor,
  listNodesByWorkspace,
  listNodesByWorkspaceForAuthor,
  updateNode,
  updateNodeForAuthor,
} from './node'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const nodeRow = {
  id: 'n1',
  workspace_id: 'w1',
  author_user_id: 'u1',
  parent_node_id: 'n1',
  depth: 0,
  type: 'decision' as const,
  title: 'Root',
  status: 'open' as const,
  confidence: 'medium' as const,
  summary: 'summary',
  conclusion: null,
  rationale: null,
  created_at: '2026-03-17T00:00:00.000Z',
  updated_at: '2026-03-17T00:00:00.000Z',
}

describe('node queries', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  test('listNodesByWorkspace maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [nodeRow] } as never)

    const result = await listNodesByWorkspace('w1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'n1',
      workspaceId: 'w1',
      parentNodeId: 'n1',
      depth: 0,
    })
  })

  test('listNodesByWorkspaceForAuthor returns rows for owner and empty for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [nodeRow] } as never)
    const ownedResult = await listNodesByWorkspaceForAuthor('w1', 'u1')
    expect(ownedResult).toHaveLength(1)
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['w1', 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await listNodesByWorkspaceForAuthor('w1', 'u2')
    expect(nonOwnerResult).toEqual([])
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['w1', 'u2'],
    )
  })

  test('getNodeById returns null when not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await getNodeById('missing')

    expect(result).toBeNull()
  })

  test('getNodeByIdForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [nodeRow] } as never)
    const ownedResult = await getNodeByIdForAuthor('n1', 'u1')
    expect(ownedResult?.id).toBe('n1')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n1', 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await getNodeByIdForAuthor('n1', 'u2')
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n1', 'u2'],
    )
  })

  test('createNode enforces parent in same workspace and returns mapped row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [nodeRow] } as never)

    const result = await createNode({
      workspaceId: 'w1',
      authorUserId: 'u1',
      parentNodeId: 'n1',
      type: 'decision',
      title: 'Child',
      summary: 'child summary',
    })

    expect(result.id).toBe('n1')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM nodes AS parent'),
      expect.any(Array),
    )
  })

  test('createNodeForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [nodeRow] } as never)

    const ownedResult = await createNodeForAuthor({
      workspaceId: 'w1',
      authorUserId: 'u1',
      parentNodeId: 'n1',
      type: 'decision',
      title: 'Child',
      summary: 'child summary',
    })

    expect(ownedResult?.id).toBe('n1')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      expect.any(Array),
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await createNodeForAuthor({
      workspaceId: 'w1',
      authorUserId: 'u2',
      parentNodeId: 'n1',
      type: 'decision',
      title: 'Child',
      summary: 'child summary',
    })
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      expect.any(Array),
    )
  })

  test('createNodeForAuthorInTransaction uses provided client query executor', async () => {
    const transactionQueryMock = jest.fn(async () => ({
      rows: [nodeRow],
    }))

    const result = await createNodeForAuthorInTransaction(
      {
        query: transactionQueryMock,
      } as never,
      {
        workspaceId: 'w1',
        authorUserId: 'u1',
        parentNodeId: 'n1',
        type: 'decision',
        title: 'Child',
        summary: 'child summary',
      },
    )

    expect(result?.id).toBe('n1')
    expect(transactionQueryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('createNode throws when parent is missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    await expect(
      createNode({
        workspaceId: 'w1',
        authorUserId: 'u1',
        parentNodeId: 'missing',
        type: 'question',
        title: 'What now?',
        summary: 'summary',
      }),
    ).rejects.toThrow('Parent node not found in workspace')
  })

  test('updateNode returns null when node is missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await updateNode({
      id: 'missing',
      summary: 'updated',
    })

    expect(result).toBeNull()
  })

  test('updateNodeForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [nodeRow] } as never)
    const ownedResult = await updateNodeForAuthor(
      {
        id: 'n1',
        summary: 'updated',
      },
      'u1',
    )
    expect(ownedResult?.id).toBe('n1')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('w.author_user_id = $16'),
      expect.any(Array),
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await updateNodeForAuthor(
      {
        id: 'n1',
        summary: 'updated',
      },
      'u2',
    )
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('w.author_user_id = $16'),
      expect.any(Array),
    )
  })

  test('deleteNode returns null when target node does not exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await deleteNode('missing')

    expect(result).toBeNull()
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  test('deleteNode deletes workspace cascade when deleting root node', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'n1', workspace_id: 'w1', is_workspace_root: true }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'w1', deleted_node_count: 6, deleted_message_count: 12 }],
      } as never)

    const result = await deleteNode('n1')

    expect(result).toEqual({
      id: 'n1',
      deletedWorkspace: true,
      deletedNodeCount: 6,
      deletedMessageCount: 12,
    })
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM workspaces'),
      ['w1'],
    )
  })

  test('deleteNode deletes subtree and counts downstream messages', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'n2', workspace_id: 'w1', is_workspace_root: false }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ deleted_node_count: 3, deleted_message_count: 7 }],
      } as never)

    const result = await deleteNode('n2')

    expect(result).toEqual({
      id: 'n2',
      deletedWorkspace: false,
      deletedNodeCount: 3,
      deletedMessageCount: 7,
    })
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WITH RECURSIVE subtree'),
      ['n2'],
    )
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('target_messages'),
      ['n2'],
    )
  })

  test('deleteNodeForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await deleteNodeForAuthor('n2', 'u2')
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n2', 'u2'],
    )

    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'n2', workspace_id: 'w1', is_workspace_root: false }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ deleted_node_count: 3, deleted_message_count: 7 }],
      } as never)

    const ownedResult = await deleteNodeForAuthor('n2', 'u1')
    expect(ownedResult).toEqual({
      id: 'n2',
      deletedWorkspace: false,
      deletedNodeCount: 3,
      deletedMessageCount: 7,
    })
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n2', 'u1'],
    )
    expect(queryMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n2', 'u1'],
    )
  })
})
