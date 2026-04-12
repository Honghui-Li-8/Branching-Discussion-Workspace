import { appendConversationTurnEvent as appendConversationTurnEventRecord } from '../db/queries/conversationTurnEvent.js'
import { createLogger } from '../logging/logger.js'
import { turnEventBroker } from './stream/broker.js'
import {
  createTurnStreamEvent,
  type ChatTurnStreamEventInput,
  TurnEventSequencer,
} from './stream/events.js'

const logger = createLogger('chat-turn')

export type TurnEventPublisher = (event: ChatTurnStreamEventInput) => Promise<void>

export const createTurnEventPublisher = (
  turnId: string,
  currentUserId: string,
): TurnEventPublisher => {
  const eventSequencer = new TurnEventSequencer(turnId)

  return async (event) => {
    const transientEvent = createTurnStreamEvent(eventSequencer, event)
    let streamEvent = transientEvent

    if (transientEvent.type === 'turn.status') {
      logger.info('[chat-stream] turn.status event queued.', {
        turn_id: turnId,
        author_user_id: currentUserId,
        seq: transientEvent.seq,
        status: transientEvent.payload.status,
        detail: transientEvent.payload.detail ?? null,
      })
    }

    try {
      const persistedEvent = await appendConversationTurnEventRecord({
        turnId,
        seq: transientEvent.seq,
        eventType: transientEvent.type,
        payload: transientEvent.payload,
      })

      if (persistedEvent) {
        streamEvent = {
          ...transientEvent,
          eventId: persistedEvent.id,
          ts: persistedEvent.createdAt,
        }
        if (streamEvent.type === 'turn.status') {
          logger.info('[chat-stream] turn.status event persisted.', {
            turn_id: turnId,
            author_user_id: currentUserId,
            seq: streamEvent.seq,
            event_id: streamEvent.eventId ?? null,
            status: streamEvent.payload.status,
            detail: streamEvent.payload.detail ?? null,
          })
        }
      }
    } catch (error) {
      logger.warn('[chat-stream] Failed to persist turn stream event.', {
        turn_id: turnId,
        author_user_id: currentUserId,
        seq: transientEvent.seq,
        event_type: transientEvent.type,
        error,
      })
    }

    try {
      turnEventBroker.publish({
        turnId,
        authorUserId: currentUserId,
        event: streamEvent,
      })
      if (streamEvent.type === 'turn.status') {
        logger.info('[chat-stream] turn.status event published to broker.', {
          turn_id: turnId,
          author_user_id: currentUserId,
          seq: streamEvent.seq,
          event_id: streamEvent.eventId ?? null,
          status: streamEvent.payload.status,
          detail: streamEvent.payload.detail ?? null,
        })
      }
    } catch (error) {
      logger.warn('[chat-stream] Failed to publish turn event.', {
        turn_id: turnId,
        author_user_id: currentUserId,
        event_type: streamEvent.type,
        error,
      })
    }
  }
}
