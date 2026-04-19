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
    expect(state.summaryStatus).toBe('pending')
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

  test('applies summary completion as metadata-only enrichment after message completion', () => {
    let state = conversationStreamReducer(initialConversationStreamState, {
      type: 'eventReceived',
      event: {
        type: 'message.completed',
        turnId: 'turn-1',
        seq: 3,
        ts: '2026-03-31T00:00:03.000Z',
        payload: {
          messageId: 'msg-1',
          content: 'assistant final',
        },
      },
    })

    state = conversationStreamReducer(state, {
      type: 'eventReceived',
      event: {
        type: 'summary.completed',
        turnId: 'turn-1',
        seq: 4,
        ts: '2026-03-31T00:00:04.000Z',
        payload: {
          jobId: 'job-1',
          jobType: 'summary',
          attemptCount: 1,
          metadata: {
            tokensSaved: 12,
          },
        },
      },
    })

    expect(state.phase).toBe('done')
    expect(state.assistantDraft).toBe('')
    expect(state.summaryStatus).toBe('completed')
    expect(state.summaryMetadata).toEqual({ tokensSaved: 12 })
    expect(state.summaryError).toBeNull()
  })

  test('dedupes duplicate summary.completed and converges on highest-seq summary.failed', () => {
    let state = conversationStreamReducer(initialConversationStreamState, {
      type: 'eventReceived',
      event: {
        type: 'summary.completed',
        turnId: 'turn-1',
        seq: 7,
        eventId: 101,
        ts: '2026-03-31T00:00:07.000Z',
        payload: {
          jobId: 'job-1',
          jobType: 'summary',
          attemptCount: 1,
          metadata: {
            version: 'a',
          },
        },
      },
    })

    const deduped = conversationStreamReducer(state, {
      type: 'eventReceived',
      event: {
        type: 'summary.completed',
        turnId: 'turn-1',
        seq: 7,
        eventId: 101,
        ts: '2026-03-31T00:00:07.000Z',
        payload: {
          jobId: 'job-1',
          jobType: 'summary',
          attemptCount: 1,
          metadata: {
            version: 'duplicate',
          },
        },
      },
    })

    state = conversationStreamReducer(deduped, {
      type: 'eventReceived',
      event: {
        type: 'summary.failed',
        turnId: 'turn-1',
        seq: 8,
        eventId: 102,
        ts: '2026-03-31T00:00:08.000Z',
        payload: {
          jobId: 'job-1',
          jobType: 'summary',
          attemptCount: 2,
          terminal: true,
          error: 'summary unavailable',
        },
      },
    })

    expect(deduped.summaryMetadata).toEqual({ version: 'a' })
    expect(deduped.lastSeq).toBe(7)
    expect(deduped.lastEventId).toBe(101)
    expect(state.summaryStatus).toBe('failed')
    expect(state.summaryError).toBe('summary unavailable')
    expect(state.lastSeq).toBe(8)
    expect(state.lastEventId).toBe(102)
  })

  test('accepts durable summary event with low seq when eventId advances', () => {
    let state = conversationStreamReducer(initialConversationStreamState, {
      type: 'eventReceived',
      event: {
        type: 'message.completed',
        turnId: 'turn-1',
        seq: 9,
        ts: '2026-03-31T00:00:09.000Z',
        payload: {
          messageId: 'msg-1',
          content: 'final',
        },
      },
    })

    state = conversationStreamReducer(state, {
      type: 'eventReceived',
      event: {
        type: 'summary.completed',
        turnId: 'turn-1',
        seq: 1,
        eventId: 201,
        ts: '2026-03-31T00:00:10.000Z',
        payload: {
          jobId: 'job-1',
          jobType: 'summary',
          attemptCount: 1,
          metadata: {
            source: 'replay',
          },
        },
      },
    })

    expect(state.summaryStatus).toBe('completed')
    expect(state.summaryMetadata).toEqual({ source: 'replay' })
    expect(state.lastSeq).toBe(9)
    expect(state.lastEventId).toBe(201)
  })

  test('maps stage + errors to UX labels', () => {
    const generating = conversationStreamReducer(initialConversationStreamState, {
      type: 'sendRequested',
    })
    expect(getConversationStreamStatusLabel(generating)).toBe('Loading context...')

    const awaitingModel = conversationStreamReducer(generating, {
      type: 'eventReceived',
      event: {
        type: 'turn.status',
        turnId: 'turn-1',
        seq: 1,
        ts: '2026-04-08T00:00:01.000Z',
        payload: { status: 'awaiting_model' },
      },
    })
    expect(getConversationStreamStatusLabel(awaitingModel)).toBe('Waiting for model service...')

    const failed = conversationStreamReducer(generating, {
      type: 'sendFailed',
      errorMessage: 'boom',
    })
    expect(getConversationStreamStatusLabel(failed)).toBe('Error: boom')
  })

  test('promotes loading_context to generating when token deltas arrive before turn.status', () => {
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
        type: 'token.delta',
        turnId: 'turn-1',
        seq: 1,
        ts: '2026-04-08T00:00:01.000Z',
        payload: { delta: 'hello' },
      },
    })

    expect(state.phase).toBe('generating')
    expect(state.stage).toBe('generating')
    expect(getConversationStreamStatusLabel(state)).toBe('Generating response...')
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

  test('branch follow-up bootstrap injects initial generating state without stream events', () => {
    // When navigating to a branch child node immediately after submit, the bootstrap
    // from branchAndSendFollowup seeds the stream state: sendRequested → turnBound.
    // No stream events have arrived yet. The state must reflect that generation is
    // underway so the UI shows a pending follow-up message.
    let state = conversationStreamReducer(initialConversationStreamState, {
      type: 'sendRequested',
    })

    expect(state.phase).toBe('sending')
    expect(state.stage).toBe('loading_context')
    expect(state.turnId).toBeNull()
    expect(state.assistantDraft).toBe('')

    state = conversationStreamReducer(state, {
      type: 'turnBound',
      turnId: 'branch-turn-1',
    })

    expect(state.phase).toBe('sending')
    expect(state.turnId).toBe('branch-turn-1')
    // Not yet generating — no stream events have arrived.
    expect(state.assistantDraft).toBe('')
    expect(state.errorMessage).toBeNull()
  })

  test('same-session generation failure shows error state and retry resets to clean sending', () => {
    // When branchFollowupStatus resolves to "failed", the UI dispatches sendFailed
    // (via useNodeConversation's status-transition effect) to show the failed message
    // in the child node. Retrying the follow-up must reset state to allow a new turn.
    let state = conversationStreamReducer(initialConversationStreamState, {
      type: 'sendRequested',
    })
    state = conversationStreamReducer(state, {
      type: 'turnBound',
      turnId: 'branch-turn-1',
    })
    state = conversationStreamReducer(state, {
      type: 'sendFailed',
      errorMessage: 'Follow-up generation failed.',
    })

    expect(state.phase).toBe('error')
    expect(state.errorMessage).toBe('Follow-up generation failed.')
    expect(state.turnId).toBe('branch-turn-1')
    expect(state.assistantDraft).toBe('')

    // Retry: UI resets state and initiates a new send for the same text.
    state = conversationStreamReducer(state, { type: 'reset' })
    expect(state).toEqual(initialConversationStreamState)

    state = conversationStreamReducer(state, { type: 'sendRequested' })
    state = conversationStreamReducer(state, { type: 'turnBound', turnId: 'branch-turn-2' })

    expect(state.phase).toBe('sending')
    expect(state.turnId).toBe('branch-turn-2')
    expect(state.errorMessage).toBeNull()
  })

  test('parses summary lifecycle payloads safely', () => {
    expect(
      parseConversationStreamEvent(
        JSON.stringify({
          type: 'summary.completed',
          turnId: 'turn-1',
          seq: 5,
          eventId: 105,
          ts: '2026-03-31T00:00:05.000Z',
          payload: {
            jobId: 'job-1',
            jobType: 'summary',
            attemptCount: 1,
            metadata: {
              source: 'worker',
            },
          },
        }),
      ),
    ).not.toBeNull()

    expect(
      parseConversationStreamEvent(
        JSON.stringify({
          type: 'summary.failed',
          turnId: 'turn-1',
          seq: 6,
          eventId: 106,
          ts: '2026-03-31T00:00:06.000Z',
          payload: {
            jobId: 'job-1',
            jobType: 'summary',
            attemptCount: 2,
            terminal: false,
            error: 'boom',
          },
        }),
      ),
    ).not.toBeNull()

    expect(
      parseConversationStreamEvent(
        JSON.stringify({
          type: 'summary.completed',
          turnId: 'turn-1',
          seq: 5,
          eventId: 0,
          ts: '2026-03-31T00:00:05.000Z',
          payload: {
            jobId: 'job-1',
            jobType: 'summary',
            attemptCount: -1,
          },
        }),
      ),
    ).toBeNull()
  })
})
