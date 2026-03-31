import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { query } from '../client.js'
import {
  appendConversationTurnEvent,
  getMaxConversationTurnEventSeq,
  listConversationTurnEventsAfterId,
  listConversationTurnEventsAfterIdForAuthor,
} from './conversationTurnEvent'

jest.mock('../client.js', () => ({
  query: jest.fn(),
}))

const queryMock = query as unknown as jest.MockedFunction<typeof query>

const eventRow = {
  id: 101,
  turn_id: 'turn-1',
  seq: 7,
  event_type: 'summary.completed',
  payload: { summary: 'short summary' },
  created_at: '2026-03-31T00:00:10.000Z',
}

describe('conversation turn event queries', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  test('appendConversationTurnEvent inserts and maps persisted row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [eventRow] } as never)

    const result = await appendConversationTurnEvent({
      turnId: 'turn-1',
      seq: 7,
      eventType: 'summary.completed',
      payload: { summary: 'short summary' },
    })

    expect(result).toEqual({
      id: 101,
      turnId: 'turn-1',
      seq: 7,
      eventType: 'summary.completed',
      payload: { summary: 'short summary' },
      createdAt: '2026-03-31T00:00:10.000Z',
    })
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO conversation_turn_event'),
      [
        'turn-1',
        7,
        'summary.completed',
        JSON.stringify({ summary: 'short summary' }),
      ],
    )
  })

  test('getMaxConversationTurnEventSeq returns zero when no rows exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never)
    const emptyResult = await getMaxConversationTurnEventSeq('turn-1')
    expect(emptyResult).toBe(0)

    queryMock.mockResolvedValueOnce({ rows: [{ max_seq: 11 }] } as never)
    const populatedResult = await getMaxConversationTurnEventSeq('turn-1')
    expect(populatedResult).toBe(11)
  })

  test('listConversationTurnEventsAfterId returns ordered events after id cursor', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        eventRow,
        {
          ...eventRow,
          id: 102,
          seq: 8,
          event_type: 'summary.failed',
          payload: { reason: 'timeout' },
        },
      ],
    } as never)

    const result = await listConversationTurnEventsAfterId('turn-1', 100, 50)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(101)
    expect(result[1].id).toBe(102)
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND id > $2'),
      ['turn-1', 100, 50],
    )
  })

  test('listConversationTurnEventsAfterIdForAuthor scopes replay rows by owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [eventRow] } as never)

    const result = await listConversationTurnEventsAfterIdForAuthor(
      'turn-1',
      'user-1',
      100,
      25,
    )

    expect(result).toHaveLength(1)
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND w.author_user_id = $2'),
      ['turn-1', 'user-1', 100, 25],
    )
  })
})
