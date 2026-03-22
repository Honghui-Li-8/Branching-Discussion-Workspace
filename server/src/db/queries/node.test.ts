import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import { createNode, deleteNode, getNodeById, listNodesByWorkspace, updateNode } from './node'

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

  test('getNodeById returns null when not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await getNodeById('missing')

    expect(result).toBeNull()
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
})
