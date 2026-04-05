import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { PoolClient } from 'pg'
import { getClient } from '../db/client.js'
import {
  branchMessageFromSelectionInTransaction,
  MessageBranchSelectionConflictError,
} from './branchMessageFromSelection.js'

jest.mock('../db/client.js', () => ({
  getClient: jest.fn(),
}))

const getClientMock = getClient as jest.MockedFunction<typeof getClient>

type QueryMock = jest.MockedFunction<
  (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
>

const createMockClient = (): {
  queryMock: QueryMock
  releaseMock: jest.Mock
} => {
  const queryMock = jest.fn() as QueryMock
  const releaseMock = jest.fn()
  getClientMock.mockResolvedValue({
    query: queryMock as unknown as PoolClient['query'],
    release: releaseMock,
  } as unknown as PoolClient)
  return { queryMock, releaseMock }
}

const buildInput = () => ({
  messageId: 'm1',
  selection: {
    quote: 'hello world',
    selectorJson: {
      selector: [{ quote: 'hello world', start: 0, end: 11 }],
    },
    startOffset: 0,
    endOffset: 11,
  },
  idempotencyKey: 'idem-1',
})

const sourceRow = {
  message_id: 'm1',
  parent_node_id: 'n-parent',
  workspace_id: 'w1',
}

const baseAnnotationRow = {
  id: 'a1',
  message_id: 'm1',
  leads_to_node_id: null,
  kind: 'branch' as const,
  quote: 'hello world',
  start_offset: 0,
  end_offset: 11,
  selector_json: {
    selector: [{ quote: 'hello world', start: 0, end: 11 }],
  },
  created_by_user_id: 'u1',
  created_at: new Date('2026-04-04T00:00:00.000Z'),
  updated_at: new Date('2026-04-04T00:00:00.000Z'),
  deleted_at: null,
}

describe('branchMessageFromSelectionInTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('creates branch annotation and node in one transaction', async () => {
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sourceRow] }) // source
      .mockResolvedValueOnce({ rows: [] }) // existing idempotent row
      .mockResolvedValueOnce({ rows: [baseAnnotationRow] }) // inserted placeholder annotation
      .mockResolvedValueOnce({ rows: [{ id: 'n-child-1' }] }) // inserted node
      .mockResolvedValueOnce({
        rows: [{ ...baseAnnotationRow, leads_to_node_id: 'n-child-1' }],
      }) // linked annotation
      .mockResolvedValueOnce({ rows: [] }) // COMMIT

    const result = await branchMessageFromSelectionInTransaction({
      input: buildInput(),
      currentUserId: 'u1',
    })

    expect(result).toEqual({
      annotation: {
        id: 'a1',
        messageId: 'm1',
        leadsToNodeId: 'n-child-1',
        kind: 'branch',
        quote: 'hello world',
        startOffset: 0,
        endOffset: 11,
        selectorJson: {
          selector: [{ quote: 'hello world', start: 0, end: 11 }],
        },
        createdByUserId: 'u1',
        createdAt: '2026-04-04T00:00:00.000Z',
        updatedAt: '2026-04-04T00:00:00.000Z',
        deletedAt: null,
      },
      branchNodeId: 'n-child-1',
    })
    expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(queryMock).toHaveBeenLastCalledWith('COMMIT')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })

  test('replays idempotent request without creating a new node', async () => {
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sourceRow] }) // source
      .mockResolvedValueOnce({
        rows: [{ ...baseAnnotationRow, leads_to_node_id: 'n-existing' }],
      }) // existing idempotent row
      .mockResolvedValueOnce({ rows: [] }) // COMMIT

    const result = await branchMessageFromSelectionInTransaction({
      input: buildInput(),
      currentUserId: 'u1',
    })

    expect(result?.branchNodeId).toBe('n-existing')
    expect(queryMock).toHaveBeenCalledTimes(4)
    expect(queryMock).toHaveBeenLastCalledWith('COMMIT')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })

  test('returns null and rolls back when message is inaccessible', async () => {
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // source not found
      .mockResolvedValueOnce({ rows: [] }) // ROLLBACK

    const result = await branchMessageFromSelectionInTransaction({
      input: buildInput(),
      currentUserId: 'u1',
    })

    expect(result).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(3, 'ROLLBACK')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })

  test('throws conflict when existing idempotency row has no linked branch node', async () => {
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sourceRow] }) // source
      .mockResolvedValueOnce({ rows: [baseAnnotationRow] }) // existing incomplete row
      .mockResolvedValueOnce({ rows: [] }) // ROLLBACK

    await expect(
      branchMessageFromSelectionInTransaction({
        input: buildInput(),
        currentUserId: 'u1',
      }),
    ).rejects.toBeInstanceOf(MessageBranchSelectionConflictError)

    expect(queryMock).toHaveBeenLastCalledWith('ROLLBACK')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })

  test('rolls back when node creation fails after placeholder insert', async () => {
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sourceRow] }) // source
      .mockResolvedValueOnce({ rows: [] }) // no existing idempotent row
      .mockResolvedValueOnce({ rows: [baseAnnotationRow] }) // inserted placeholder annotation
      .mockRejectedValueOnce(new Error('insert node failed')) // insert node
      .mockResolvedValueOnce({ rows: [] }) // ROLLBACK

    await expect(
      branchMessageFromSelectionInTransaction({
        input: buildInput(),
        currentUserId: 'u1',
      }),
    ).rejects.toThrow('insert node failed')

    expect(queryMock).toHaveBeenLastCalledWith('ROLLBACK')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })
})
