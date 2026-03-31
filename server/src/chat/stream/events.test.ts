import { describe, expect, test } from '@jest/globals'
import {
  TurnEventSequencer,
  chatTurnStreamEventSchema,
  createTurnStreamEvent,
  validateChatTurnStreamEvent,
} from './events'

describe('chat stream event protocol', () => {
  test('sequencer increments monotonically', () => {
    const sequencer = new TurnEventSequencer('turn-1')

    expect(sequencer.currentSeq).toBe(0)
    expect(sequencer.nextSeq()).toBe(1)
    expect(sequencer.nextSeq()).toBe(2)
    expect(sequencer.currentSeq).toBe(2)
  })

  test('sequencer rejects invalid constructor input', () => {
    expect(() => new TurnEventSequencer('')).toThrow('turnId is required')
    expect(() => new TurnEventSequencer('turn-1', -1)).toThrow(
      'startingSeq must be a non-negative integer',
    )
    expect(() => new TurnEventSequencer('turn-1', 1.1)).toThrow(
      'startingSeq must be a non-negative integer',
    )
  })

  test('createTurnStreamEvent adds envelope fields and validates schema', () => {
    const sequencer = new TurnEventSequencer('turn-1')
    const at = new Date('2026-03-31T00:00:00.000Z')

    const started = createTurnStreamEvent(
      sequencer,
      {
        type: 'turn.started',
        payload: { status: 'loading_context' },
      },
      { at },
    )
    const delta = createTurnStreamEvent(
      sequencer,
      {
        type: 'token.delta',
        payload: { delta: 'hel' },
      },
      { at },
    )

    expect(started).toEqual({
      turnId: 'turn-1',
      seq: 1,
      ts: '2026-03-31T00:00:00.000Z',
      type: 'turn.started',
      payload: { status: 'loading_context' },
    })
    expect(delta.seq).toBe(2)
    expect(chatTurnStreamEventSchema.safeParse(delta).success).toBe(true)
  })

  test('validateChatTurnStreamEvent rejects malformed payloads', () => {
    expect(() =>
      validateChatTurnStreamEvent({
        turnId: 'turn-1',
        seq: 1,
        ts: '2026-03-31T00:00:00.000Z',
        type: 'turn.status',
        payload: { status: 'unknown' },
      }),
    ).toThrow()

    expect(() =>
      validateChatTurnStreamEvent({
        turnId: 'turn-1',
        seq: 0,
        ts: '2026-03-31T00:00:00.000Z',
        type: 'token.delta',
        payload: { delta: 'x' },
      }),
    ).toThrow()
  })

  test('supports async summary lifecycle event variants', () => {
    const completed = validateChatTurnStreamEvent({
      turnId: 'turn-1',
      seq: 9,
      eventId: 201,
      ts: '2026-03-31T00:00:09.000Z',
      type: 'summary.completed',
      payload: {
        jobId: 'job-1',
        jobType: 'summary',
        attemptCount: 1,
        metadata: {
          source: 'worker',
        },
      },
    })
    const failed = validateChatTurnStreamEvent({
      turnId: 'turn-1',
      seq: 10,
      eventId: 202,
      ts: '2026-03-31T00:00:10.000Z',
      type: 'summary.failed',
      payload: {
        jobId: 'job-1',
        jobType: 'summary',
        attemptCount: 2,
        terminal: true,
        error: 'summary failed',
      },
    })

    expect(completed.type).toBe('summary.completed')
    expect(failed.type).toBe('summary.failed')
  })
})
