import type { ChatTurnStreamEvent } from './events.js'

type StreamEventListener = (event: ChatTurnStreamEvent) => void

type TurnEventChannel = {
  turnId: string
  authorUserId: string
}

type TurnEventSubscription = TurnEventChannel & {
  onEvent: StreamEventListener
}

type PublishTurnEventInput = TurnEventChannel & {
  event: ChatTurnStreamEvent
}

const buildChannelKey = ({ turnId, authorUserId }: TurnEventChannel): string =>
  `${authorUserId}:${turnId}`

export class TurnEventBroker {
  private readonly listenersByChannel = new Map<string, Set<StreamEventListener>>()

  subscribe(input: TurnEventSubscription): () => void {
    const channelKey = buildChannelKey(input)
    const listeners = this.listenersByChannel.get(channelKey) ?? new Set<StreamEventListener>()
    listeners.add(input.onEvent)
    this.listenersByChannel.set(channelKey, listeners)

    return () => {
      const channelListeners = this.listenersByChannel.get(channelKey)
      if (!channelListeners) {
        return
      }

      channelListeners.delete(input.onEvent)
      if (channelListeners.size === 0) {
        this.listenersByChannel.delete(channelKey)
      }
    }
  }

  publish(input: PublishTurnEventInput): number {
    const listeners = this.listenersByChannel.get(buildChannelKey(input))
    if (!listeners || listeners.size === 0) {
      return 0
    }

    for (const listener of listeners) {
      listener(input.event)
    }

    return listeners.size
  }

  listenerCount(input: TurnEventChannel): number {
    return this.listenersByChannel.get(buildChannelKey(input))?.size ?? 0
  }

  clear(): void {
    this.listenersByChannel.clear()
  }
}

export const turnEventBroker = new TurnEventBroker()
