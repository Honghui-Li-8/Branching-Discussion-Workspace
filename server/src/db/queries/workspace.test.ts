import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaceById,
  listWorkspaces,
  updateWorkspace,
} from './workspace'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const workspaceRow = {
  id: 'w1',
  title: 'Workspace One',
  summary: 'Root summary',
  author_user_id: 'u1',
  root_node_id: 'n1',
  created_at: '2026-03-17T00:00:00.000Z',
  updated_at: '2026-03-17T00:00:00.000Z',
}

describe('workspace queries', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  test('listWorkspaces maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [workspaceRow] } as never)

    const result = await listWorkspaces()

    expect(result).toEqual([
      {
        id: 'w1',
        title: 'Workspace One',
        summary: 'Root summary',
        authorUserId: 'u1',
        rootNodeId: 'n1',
        createdAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T00:00:00.000Z',
      },
    ])
  })

  test('getWorkspaceById returns null when not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await getWorkspaceById('missing')

    expect(result).toBeNull()
  })

  test('createWorkspace throws when insert returns no rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    await expect(
      createWorkspace({
        authorUserId: 'u1',
        title: 'Workspace One',
      }),
    ).rejects.toThrow('Failed to create workspace')
  })

  test('updateWorkspace returns updated row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...workspaceRow, title: 'Workspace One (Updated)' }],
    } as never)

    const result = await updateWorkspace({
      id: 'w1',
      title: 'Workspace One (Updated)',
    })

    expect(result?.title).toBe('Workspace One (Updated)')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workspaces'),
      ['w1', 'Workspace One (Updated)'],
    )
  })

  test('deleteWorkspace returns cascade counters', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'w1',
          deleted_node_count: 4,
          deleted_message_count: 9,
        },
      ],
    } as never)

    const result = await deleteWorkspace('w1')

    expect(result).toEqual({
      id: 'w1',
      deletedNodeCount: 4,
      deletedMessageCount: 9,
    })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM workspaces'),
      ['w1'],
    )
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('target_messages'),
      ['w1'],
    )
  })
})
