import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  createMessageAnnotation,
  createMessageAnnotationForAuthor,
  getMessageAnnotationById,
  getMessageAnnotationByIdForAuthor,
  getMessageAnnotationByIdempotencyKeyForAuthor,
  linkMessageAnnotationToNodeForAuthor,
  listMessageAnnotationsByMessage,
  listMessageAnnotationsByMessageForAuthor,
  messageAnnotationExists,
  softDeleteMessageAnnotationForAuthor,
} from './messageAnnotation'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const annotationRow = {
  id: 'a1',
  message_id: 'm1',
  leads_to_node_id: 'n2',
  kind: 'branch' as const,
  quote: 'hello',
  start_offset: 0,
  end_offset: 5,
  selector_json: {
    selector: [{ quote: 'hello', start: 0, end: 5 }],
  },
  created_by_user_id: 'u1',
  idempotency_key: 'idem-1',
  created_at: '2026-03-17T00:00:00.000Z',
  updated_at: '2026-03-17T00:00:00.000Z',
  deleted_at: null,
}

describe('message annotation queries', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  test('listMessageAnnotationsByMessage maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [annotationRow] } as never)

    const result = await listMessageAnnotationsByMessage('m1')

    expect(result).toEqual([
      {
        id: 'a1',
        messageId: 'm1',
        leadsToNodeId: 'n2',
        kind: 'branch',
        quote: 'hello',
        startOffset: 0,
        endOffset: 5,
        selectorJson: {
          selector: [{ quote: 'hello', start: 0, end: 5 }],
        },
        createdByUserId: 'u1',
        idempotencyKey: 'idem-1',
        createdAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T00:00:00.000Z',
        deletedAt: null,
      },
    ])
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM message_annotations'),
      ['m1'],
    )
  })

  test('listMessageAnnotationsByMessageForAuthor returns rows for owner and empty for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [annotationRow] } as never)
    const ownedResult = await listMessageAnnotationsByMessageForAuthor('m1', 'u1')
    expect(ownedResult).toHaveLength(1)
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['m1', 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await listMessageAnnotationsByMessageForAuthor('m1', 'u2')
    expect(nonOwnerResult).toEqual([])
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['m1', 'u2'],
    )
  })

  test('getMessageAnnotationById returns null when missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await getMessageAnnotationById('missing')

    expect(result).toBeNull()
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE a.id = $1'),
      ['missing'],
    )
  })

  test('getMessageAnnotationByIdForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [annotationRow] } as never)
    const ownedResult = await getMessageAnnotationByIdForAuthor('a1', 'u1')
    expect(ownedResult?.id).toBe('a1')
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['a1', 'u1'],
    )

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const nonOwnerResult = await getMessageAnnotationByIdForAuthor('a1', 'u2')
    expect(nonOwnerResult).toBeNull()
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND w.author_user_id = $2'),
      ['a1', 'u2'],
    )
  })

  test('getMessageAnnotationByIdempotencyKeyForAuthor returns matching row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [annotationRow] } as never)

    const result = await getMessageAnnotationByIdempotencyKeyForAuthor({
      messageId: 'm1',
      authorUserId: 'u1',
      idempotencyKey: 'idem-1',
    })

    expect(result?.id).toBe('a1')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND a.idempotency_key = $3'),
      ['m1', 'u1', 'idem-1'],
    )
  })

  test('messageAnnotationExists returns boolean', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'a1' }] } as never)
    const exists = await messageAnnotationExists('a1')
    expect(exists).toBe(true)

    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const missing = await messageAnnotationExists('a2')
    expect(missing).toBe(false)
  })

  test('createMessageAnnotation inserts row and serializes selector payload', async () => {
    queryMock.mockResolvedValueOnce({ rows: [annotationRow] } as never)

    const result = await createMessageAnnotation({
      messageId: 'm1',
      leadsToNodeId: 'n2',
      kind: 'branch',
      quote: 'hello',
      startOffset: 0,
      endOffset: 5,
      selectorJson: {
        selector: [{ quote: 'hello', start: 0, end: 5 }],
      },
      createdByUserId: 'u1',
      idempotencyKey: 'idem-1',
    })

    expect(result.id).toBe('a1')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO message_annotations'),
      [
        'm1',
        'n2',
        'branch',
        'hello',
        0,
        5,
        '{"selector":[{"quote":"hello","start":0,"end":5}]}',
        'u1',
        'idem-1',
      ],
    )
  })

  test('createMessageAnnotation throws when source message is missing or target is invalid', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    await expect(
      createMessageAnnotation({
        messageId: 'm1',
        kind: 'branch',
        quote: 'hello',
        selectorJson: {
          selector: [{ quote: 'hello', start: 0, end: 5 }],
        },
        createdByUserId: 'u1',
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toThrow('Message not found or target node is outside message workspace')
  })

  test('createMessageAnnotationForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await createMessageAnnotationForAuthor({
      messageId: 'm1',
      kind: 'branch',
      quote: 'hello',
      selectorJson: {
        selector: [{ quote: 'hello', start: 0, end: 5 }],
      },
      authorUserId: 'u2',
      idempotencyKey: 'idem-1',
    })

    expect(result).toBeNull()
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE w.author_user_id = c.actor_user_id'),
      ['m1', null, 'branch', 'hello', null, null, '{"selector":[{"quote":"hello","start":0,"end":5}]}', 'u2', 'idem-1'],
    )
  })

  test('linkMessageAnnotationToNodeForAuthor returns null for non-owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)

    const result = await linkMessageAnnotationToNodeForAuthor(
      {
        id: 'a1',
        leadsToNodeId: 'n2',
      },
      'u2',
    )

    expect(result).toBeNull()
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND w.author_user_id = $3'),
      ['a1', 'n2', 'u2'],
    )
  })

  test('softDeleteMessageAnnotationForAuthor returns deleted id', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'a1' }] } as never)

    const result = await softDeleteMessageAnnotationForAuthor('a1', 'u1')

    expect(result).toEqual({ id: 'a1' })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('SET deleted_at = NOW()'),
      ['a1', 'u1'],
    )
  })
})
