import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  conversationTurnExists,
  createOrGetConversationTurn,
  createOrGetConversationTurnForAuthor,
  getConversationTurnById,
  getConversationTurnByIdForAuthor,
  getConversationTurnByIdempotencyKey,
  getConversationTurnByIdempotencyKeyForAuthor,
  updateConversationTurn,
  updateConversationTurnForAuthor,
} from './conversationTurn'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const conversationTurnRow = {
  id: 't1',
  node_id: 'n1',
  author_user_id: 'u1',
  status: 'pending' as const,
  model: 'gpt-5',
  idempotency_key: 'turn-key-1',
  error: null,
  completed_at: null,
  created_at: '2026-03-30T00:00:00.000Z',
  updated_at: '2026-03-30T00:00:00.000Z',
}

describe('conversation turn queries', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  test('getConversationTurnById maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [conversationTurnRow] } as never)

    const result = await getConversationTurnById('t1')

    expect(result).toEqual({
      id: 't1',
      nodeId: 'n1',
      authorUserId: 'u1',
      status: 'pending',
      model: 'gpt-5',
      idempotencyKey: 'turn-key-1',
      error: null,
      completedAt: null,
      createdAt: '2026-03-30T00:00:00.000Z',
      updatedAt: '2026-03-30T00:00:00.000Z',
    })
  })

  test('getConversationTurnByIdForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [conversationTurnRow] } as never)
    const ownedResult = await getConversationTurnByIdForAuthor('t1', 'u1')
    expect(ownedResult?.id).toBe('t1')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['t1', 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await getConversationTurnByIdForAuthor('t1', 'u2')
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['t1', 'u2'],
    )
  })

  test('getConversationTurnByIdempotencyKey maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [conversationTurnRow] } as never)

    const result = await getConversationTurnByIdempotencyKey('n1', 'u1', 'turn-key-1')

    expect(result?.id).toBe('t1')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND idempotency_key = $3'),
      ['n1', 'u1', 'turn-key-1'],
    )
  })

  test('getConversationTurnByIdempotencyKeyForAuthor filters by owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [conversationTurnRow] } as never)
    const ownedResult = await getConversationTurnByIdempotencyKeyForAuthor(
      'n1',
      'u1',
      'turn-key-1',
    )
    expect(ownedResult?.id).toBe('t1')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n1', 'u1', 'turn-key-1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await getConversationTurnByIdempotencyKeyForAuthor(
      'n1',
      'u2',
      'turn-key-1',
    )
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['n1', 'u2', 'turn-key-1'],
    )
  })

  test('conversationTurnExists returns true when a row exists', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 't1' }] } as never)

    const result = await conversationTurnExists('t1')

    expect(result).toBe(true)
  })

  test('createOrGetConversationTurn returns inserted turn and wasCreated=true', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...conversationTurnRow, was_created: true }],
    } as never)

    const result = await createOrGetConversationTurn({
      nodeId: 'n1',
      authorUserId: 'u1',
      model: 'gpt-5',
      idempotencyKey: 'turn-key-1',
      status: 'pending',
    })

    expect(result).toEqual({
      turn: {
        id: 't1',
        nodeId: 'n1',
        authorUserId: 'u1',
        status: 'pending',
        model: 'gpt-5',
        idempotencyKey: 'turn-key-1',
        error: null,
        completedAt: null,
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
      wasCreated: true,
    })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (author_user_id, node_id, idempotency_key) DO NOTHING'),
      ['n1', 'u1', true, 'pending', 'gpt-5', 'turn-key-1', false, null, false, null],
    )
  })

  test('createOrGetConversationTurnForAuthor returns existing turn and wasCreated=false', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...conversationTurnRow, status: 'completed', was_created: false }],
    } as never)

    const result = await createOrGetConversationTurnForAuthor({
      nodeId: 'n1',
      authorUserId: 'u1',
      model: 'gpt-5',
      idempotencyKey: 'turn-key-1',
    })

    expect(result?.wasCreated).toBe(false)
    expect(result?.turn.status).toBe('completed')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('JOIN workspaces w ON w.id = n.workspace_id'),
      ['n1', 'u1', false, null, 'gpt-5', 'turn-key-1', false, null, false, null],
    )
  })

  test('createOrGetConversationTurnForAuthor returns null when node is inaccessible', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await createOrGetConversationTurnForAuthor({
      nodeId: 'missing',
      authorUserId: 'u1',
      model: 'gpt-5',
      idempotencyKey: 'turn-key-1',
    })

    expect(result).toBeNull()
  })

  test('updateConversationTurn returns updated row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...conversationTurnRow, status: 'failed', error: 'oops' }],
    } as never)

    const result = await updateConversationTurn({
      id: 't1',
      status: 'failed',
      error: 'oops',
    })

    expect(result?.status).toBe('failed')
    expect(result?.error).toBe('oops')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE conversation_turns'),
      ['t1', true, 'failed', true, 'oops', false, null],
    )
  })

  test('updateConversationTurnForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...conversationTurnRow, status: 'completed' }],
    } as never)
    const ownedResult = await updateConversationTurnForAuthor(
      {
        id: 't1',
        status: 'completed',
      },
      'u1',
    )
    expect(ownedResult?.status).toBe('completed')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $8'),
      ['t1', true, 'completed', false, null, false, null, 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await updateConversationTurnForAuthor(
      {
        id: 't1',
        status: 'completed',
      },
      'u2',
    )
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $8'),
      ['t1', true, 'completed', false, null, false, null, 'u2'],
    )
  })
})
