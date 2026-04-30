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

const buildSuggestionConversionInput = () => ({
  ...buildInput(),
  annotationKind: 'suggestion-branch' as const,
  sourceAnnotationId: 'a-suggest-1',
})

const buildBranchOnExistingBranchInput = () => ({
  ...buildInput(),
  annotationKind: 'branch' as const,
  sourceAnnotationId: 'a-branch-1',
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

  test('converts existing suggestion annotation into suggestion-branch with linked node', async () => {
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sourceRow] }) // source
      .mockResolvedValueOnce({ rows: [] }) // existing idempotent row
      .mockResolvedValueOnce({
        rows: [{ ...baseAnnotationRow, id: 'a-suggest-1', kind: 'suggestion', leads_to_node_id: null }],
      }) // source suggestion annotation lock
      .mockResolvedValueOnce({ rows: [{ id: 'n-child-2' }] }) // inserted node
      .mockResolvedValueOnce({
        rows: [
          {
            ...baseAnnotationRow,
            id: 'a-suggest-1',
            kind: 'suggestion-branch',
            leads_to_node_id: 'n-child-2',
            idempotency_key: 'idem-1',
          },
        ],
      }) // transitioned annotation
      .mockResolvedValueOnce({ rows: [] }) // COMMIT

    const result = await branchMessageFromSelectionInTransaction({
      input: buildSuggestionConversionInput(),
      currentUserId: 'u1',
    })

    expect(result).toEqual({
      annotation: {
        id: 'a-suggest-1',
        messageId: 'm1',
        leadsToNodeId: 'n-child-2',
        kind: 'suggestion-branch',
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
      branchNodeId: 'n-child-2',
    })

    expect(queryMock).toHaveBeenLastCalledWith('COMMIT')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })

  test('converts suggestion even when request selection payload differs from stored annotation', async () => {
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sourceRow] }) // source
      .mockResolvedValueOnce({ rows: [] }) // existing idempotent row
      .mockResolvedValueOnce({
        rows: [{ ...baseAnnotationRow, id: 'a-suggest-1', kind: 'suggestion', quote: 'different' }],
      }) // source suggestion annotation lock
      .mockResolvedValueOnce({ rows: [{ id: 'n-child-3' }] }) // inserted node
      .mockResolvedValueOnce({
        rows: [
          {
            ...baseAnnotationRow,
            id: 'a-suggest-1',
            kind: 'suggestion-branch',
            leads_to_node_id: 'n-child-3',
            idempotency_key: 'idem-1',
          },
        ],
      }) // transitioned annotation
      .mockResolvedValueOnce({ rows: [] }) // COMMIT

    await expect(
      branchMessageFromSelectionInTransaction({
        input: buildSuggestionConversionInput(),
        currentUserId: 'u1',
      }),
    ).resolves.toEqual({
      annotation: {
        id: 'a-suggest-1',
        messageId: 'm1',
        leadsToNodeId: 'n-child-3',
        kind: 'suggestion-branch',
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
      branchNodeId: 'n-child-3',
    })

    expect(queryMock).toHaveBeenLastCalledWith('COMMIT')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })

  test('returns existing branch-linked annotation for repeated branch action', async () => {
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [sourceRow] }) // source
      .mockResolvedValueOnce({ rows: [] }) // existing idempotent row
      .mockResolvedValueOnce({
        rows: [{ ...baseAnnotationRow, id: 'a-branch-1', kind: 'branch', leads_to_node_id: 'n-child-1' }],
      }) // source annotation lock
      .mockResolvedValueOnce({ rows: [] }) // COMMIT

    await expect(
      branchMessageFromSelectionInTransaction({
        input: buildBranchOnExistingBranchInput(),
        currentUserId: 'u1',
      }),
    ).resolves.toEqual({
      annotation: {
        id: 'a-branch-1',
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

    expect(queryMock).toHaveBeenLastCalledWith('COMMIT')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })
})

describe('regression: branch-from-selection unaffected by branch-follow-up additions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('original plain-branch path (no annotationKind, no sourceAnnotationId) still runs full 7-query transaction', async () => {
    // Verifies the classic branch-from-selection flow is completely unaffected by the
    // new annotationKind/sourceAnnotationId paths added for the branch follow-up MVP.
    // Query sequence must match the pre-MVP contract: BEGIN, source, idempotency check,
    // placeholder annotation, node insert, annotation link, COMMIT.
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] })                                                               // BEGIN
      .mockResolvedValueOnce({ rows: [sourceRow] })                                                      // source context
      .mockResolvedValueOnce({ rows: [] })                                                               // no existing idempotent row
      .mockResolvedValueOnce({ rows: [baseAnnotationRow] })                                             // placeholder annotation
      .mockResolvedValueOnce({ rows: [{ id: 'n-child-reg' }] })                                        // node insert
      .mockResolvedValueOnce({ rows: [{ ...baseAnnotationRow, leads_to_node_id: 'n-child-reg' }] })    // link annotation
      .mockResolvedValueOnce({ rows: [] })                                                               // COMMIT

    const result = await branchMessageFromSelectionInTransaction({
      input: buildInput(), // no annotationKind, no sourceAnnotationId
      currentUserId: 'u1',
    })

    expect(result?.branchNodeId).toBe('n-child-reg')
    expect(result?.annotation.kind).toBe('branch')
    expect(queryMock).toHaveBeenCalledTimes(7)
    expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(queryMock).toHaveBeenLastCalledWith('COMMIT')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })

  test('explicit annotationKind: "branch" is identical to the default (no kind supplied)', async () => {
    // branchAndSendFollowup passes annotationKind: input.annotationKind ?? 'branch'.
    // When that resolves to 'branch', downstream behavior must be identical to the
    // path where annotationKind is omitted entirely — no regressions at the branch
    // boundary between the two callers.
    const { queryMock, releaseMock } = createMockClient()

    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [sourceRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [baseAnnotationRow] })
      .mockResolvedValueOnce({ rows: [{ id: 'n-child-explicit' }] })
      .mockResolvedValueOnce({ rows: [{ ...baseAnnotationRow, leads_to_node_id: 'n-child-explicit' }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await branchMessageFromSelectionInTransaction({
      input: { ...buildInput(), annotationKind: 'branch' as const },
      currentUserId: 'u1',
    })

    expect(result?.branchNodeId).toBe('n-child-explicit')
    expect(result?.annotation.kind).toBe('branch')
    expect(queryMock).toHaveBeenCalledTimes(7)
    expect(queryMock).toHaveBeenLastCalledWith('COMMIT')
    expect(releaseMock).toHaveBeenCalledTimes(1)
  })

  test('rollback still fires and client is always released when source message is inaccessible', async () => {
    // Transaction lifecycle (client acquire → BEGIN → ROLLBACK → release) must be
    // preserved after the MVP additions. This is the critical error-path regression.
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
})
