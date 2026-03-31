import { describe, expect, test } from '@jest/globals'
import {
  conversationStreamReducer,
  getConversationStreamStatusLabel,
  initialConversationStreamState,
  parseConversationStreamEvent,
} from './conversationStreamState'

describe('conversationStreamState', () => {
  test('advances through status/token/completion with monotonic seq', () => {
    let state = conversationStreamReducer(initialConversationStreamState, {
      type: 'sendRequested',
    })

    state = conversationStreamReducer(state, {
      type: 'turnBound',
      turnId: 'turn-1',
    })

    state = conversationStreamReducer(state, {
      type: 'eventReceived',
      event: {
        type: 'turn.status',
        turnId: 'turn-1',
        seq: 1,
        ts: '2026-03-31T00:00:00.000Z',
        payload: { status: 'generating' },
      },
    })

    state = conversationStreamReducer(state, {
      type: 'eventReceived',
      event: {
        type: 'token.delta',
        turnId: 'turn-1',
        seq: 2,
        ts: '2026-03-31T00:00:01.000Z',
        payload: { delta: 'hello ' },
      },
    })

    state = conversationStreamReducer(state, {
      type: 'eventReceived',
      event: {
        type: 'token.delta',
        turnId: 'turn-1',
        seq: 3,
        ts: '2026-03-31T00:00:02.000Z',
        payload: { delta: 'world' },
      },
    })

    const deduped = conversationStreamReducer(state, {
      type: 'eventReceived',
      event: {
        type: 'token.delta',
        turnId: 'turn-1',
        seq: 3,
        ts: '2026-03-31T00:00:02.000Z',
        payload: { delta: 'ignored' },
      },
    })

    state = conversationStreamReducer(deduped, {
      type: 'eventReceived',
      event: {
        type: 'message.completed',
        turnId: 'turn-1',
        seq: 4,
        ts: '2026-03-31T00:00:03.000Z',
        payload: {
          messageId: 'msg-1',
          content: 'hello world',
        },
      },
    })

    expect(deduped.assistantDraft).toBe('hello world')
    expect(state.phase).toBe('done')
    expect(state.lastSeq).toBe(4)
    expect(state.assistantDraft).toBe('')
  })

  test('ignores events from non-active turn and parses event payloads safely', () => {
    let state = conversationStreamReducer(initialConversationStreamState, {
      type: 'turnBound',
      turnId: 'turn-1',
    })

    state = conversationStreamReducer(state, {
      type: 'eventReceived',
      event: {
        type: 'turn.status',
        turnId: 'turn-2',
        seq: 1,
        ts: '2026-03-31T00:00:00.000Z',
        payload: { status: 'generating' },
      },
    })

    expect(state.turnId).toBe('turn-1')
    expect(state.lastSeq).toBe(0)

    expect(
      parseConversationStreamEvent(
        JSON.stringify({
          type: 'token.delta',
          turnId: 'turn-1',
          seq: 2,
          ts: '2026-03-31T00:00:01.000Z',
          payload: { delta: 'x' },
        }),
      ),
    ).not.toBeNull()
    expect(parseConversationStreamEvent('not-json')).toBeNull()
    expect(parseConversationStreamEvent(JSON.stringify({ type: 'unknown' }))).toBeNull()
  })

  test('maps stage + errors to UX labels', () => {
    const generating = conversationStreamReducer(initialConversationStreamState, {
      type: 'sendRequested',
    })
    expect(getConversationStreamStatusLabel(generating)).toBe('Loading context...')

    const failed = conversationStreamReducer(generating, {
      type: 'sendFailed',
      errorMessage: 'boom',
    })
    expect(getConversationStreamStatusLabel(failed)).toBe('Error: boom')
  })

  test('ignores late events after terminal completion/error states', () => {
    const doneState = conversationStreamReducer(initialConversationStreamState, {
      type: 'eventReceived',
      event: {
        type: 'message.completed',
        turnId: 'turn-1',
        seq: 3,
        ts: '2026-03-31T00:00:03.000Z',
        payload: {
          messageId: 'msg-1',
          content: 'final',
        },
      },
    })

    const doneWithLateDelta = conversationStreamReducer(doneState, {
      type: 'eventReceived',
      event: {
        type: 'token.delta',
        turnId: 'turn-1',
        seq: 4,
        ts: '2026-03-31T00:00:04.000Z',
        payload: { delta: 'ignored' },
      },
    })

    const errorState = conversationStreamReducer(initialConversationStreamState, {
      type: 'eventReceived',
      event: {
        type: 'turn.error',
        turnId: 'turn-1',
        seq: 2,
        ts: '2026-03-31T00:00:02.000Z',
        payload: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'failed',
        },
      },
    })

    const errorWithLateComplete = conversationStreamReducer(errorState, {
      type: 'eventReceived',
      event: {
        type: 'message.completed',
        turnId: 'turn-1',
        seq: 3,
        ts: '2026-03-31T00:00:03.000Z',
        payload: {
          messageId: 'msg-2',
          content: 'ignored',
        },
      },
    })

    expect(doneWithLateDelta).toEqual(doneState)
    expect(errorWithLateComplete).toEqual(errorState)
  })
})
