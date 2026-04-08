type TurnStage =
  | 'loading_context'
  | 'retrieving'
  | 'generating'
  | 'summarizing'
  | 'persisting'

type TurnStartedEvent = {
  type: 'turn.started'
  turnId: string
  seq: number
  eventId?: number
  ts: string
  payload: {
    status: 'loading_context'
  }
}

type TurnStatusEvent = {
  type: 'turn.status'
  turnId: string
  seq: number
  eventId?: number
  ts: string
  payload: {
    status: TurnStage
    detail?: string | null
  }
}

type TokenDeltaEvent = {
  type: 'token.delta'
  turnId: string
  seq: number
  eventId?: number
  ts: string
  payload: {
    delta: string
  }
}

type MessageCompletedEvent = {
  type: 'message.completed'
  turnId: string
  seq: number
  eventId?: number
  ts: string
  payload: {
    messageId: string
    content: string
  }
}

type TurnErrorEvent = {
  type: 'turn.error'
  turnId: string
  seq: number
  eventId?: number
  ts: string
  payload: {
    code: string
    message: string
  }
}

type SummaryCompletedEvent = {
  type: 'summary.completed'
  turnId: string
  seq: number
  eventId?: number
  ts: string
  payload: {
    jobId: string
    jobType: 'summary'
    attemptCount: number
    metadata?: Record<string, unknown>
  }
}

type SummaryFailedEvent = {
  type: 'summary.failed'
  turnId: string
  seq: number
  eventId?: number
  ts: string
  payload: {
    jobId: string
    jobType: 'summary'
    attemptCount: number
    terminal: boolean
    error: string
  }
}

export type ConversationStreamEvent =
  | TurnStartedEvent
  | TurnStatusEvent
  | TokenDeltaEvent
  | MessageCompletedEvent
  | TurnErrorEvent
  | SummaryCompletedEvent
  | SummaryFailedEvent

export type ConversationStreamPhase =
  | 'idle'
  | 'sending'
  | 'generating'
  | 'done'
  | 'error'

export type ConversationStreamState = {
  phase: ConversationStreamPhase
  turnId: string | null
  stage: TurnStage | null
  lastSeq: number
  lastEventId: number
  assistantDraft: string
  errorMessage: string | null
  summaryStatus: 'idle' | 'pending' | 'completed' | 'failed'
  summaryMetadata: Record<string, unknown> | null
  summaryError: string | null
  summaryUpdatedAt: string | null
}

type ConversationStreamAction =
  | { type: 'reset' }
  | { type: 'sendRequested' }
  | { type: 'turnBound'; turnId: string }
  | { type: 'sendCompleted' }
  | { type: 'sendFailed'; errorMessage: string }
  | { type: 'eventReceived'; event: ConversationStreamEvent }

export const initialConversationStreamState: ConversationStreamState = {
  phase: 'idle',
  turnId: null,
  stage: null,
  lastSeq: 0,
  lastEventId: 0,
  assistantDraft: '',
  errorMessage: null,
  summaryStatus: 'idle',
  summaryMetadata: null,
  summaryError: null,
  summaryUpdatedAt: null,
}

const withEventEnvelope = (
  state: ConversationStreamState,
  event: ConversationStreamEvent,
): ConversationStreamState => ({
  ...state,
  turnId: event.turnId,
  lastSeq: Math.max(state.lastSeq, event.seq),
  lastEventId: event.eventId ? Math.max(state.lastEventId, event.eventId) : state.lastEventId,
})

export const conversationStreamReducer = (
  state: ConversationStreamState,
  action: ConversationStreamAction,
): ConversationStreamState => {
  switch (action.type) {
    case 'reset':
      return initialConversationStreamState
    case 'sendRequested':
      return {
        phase: 'sending',
        turnId: null,
        stage: 'loading_context',
        lastSeq: 0,
        lastEventId: 0,
        assistantDraft: '',
        errorMessage: null,
        summaryStatus: 'pending',
        summaryMetadata: null,
        summaryError: null,
        summaryUpdatedAt: null,
      }
    case 'turnBound':
      return {
        ...state,
        turnId: action.turnId,
      }
    case 'sendCompleted':
      return {
        ...state,
        phase: 'done',
        stage: null,
        assistantDraft: '',
        errorMessage: null,
      }
    case 'sendFailed':
      return {
        ...state,
        phase: 'error',
        stage: null,
        assistantDraft: '',
        errorMessage: action.errorMessage,
      }
    case 'eventReceived': {
      const { event } = action
      if (
        (state.phase === 'done' || state.phase === 'error') &&
        event.type !== 'summary.completed' &&
        event.type !== 'summary.failed'
      ) {
        return state
      }
      if (state.turnId && event.turnId !== state.turnId) {
        return state
      }
      if (event.eventId !== undefined) {
        if (event.eventId <= state.lastEventId) {
          return state
        }
      } else if (event.seq <= state.lastSeq) {
        return state
      }

      switch (event.type) {
        case 'turn.started':
          return withEventEnvelope(
            {
              ...state,
              phase: 'sending',
              stage: 'loading_context',
              errorMessage: null,
            },
            event,
          )
        case 'turn.status':
          return withEventEnvelope(
            {
              ...state,
              phase: 'generating',
              stage: event.payload.status,
              errorMessage: null,
            },
            event,
          )
        case 'token.delta':
          return withEventEnvelope(
            {
              ...state,
              phase: 'generating',
              stage: 'generating',
              assistantDraft: `${state.assistantDraft}${event.payload.delta}`,
              errorMessage: null,
            },
            event,
          )
        case 'message.completed':
          return withEventEnvelope(
            {
              ...state,
              phase: 'done',
              stage: null,
              assistantDraft: '',
              errorMessage: null,
            },
            event,
          )
        case 'turn.error':
          return withEventEnvelope(
            {
              ...state,
              phase: 'error',
              stage: null,
              assistantDraft: '',
              errorMessage: event.payload.message,
            },
            event,
          )
        case 'summary.completed':
          return withEventEnvelope(
            {
              ...state,
              summaryStatus: 'completed',
              summaryMetadata: event.payload.metadata ?? null,
              summaryError: null,
              summaryUpdatedAt: event.ts,
            },
            event,
          )
        case 'summary.failed':
          return withEventEnvelope(
            {
              ...state,
              summaryStatus: 'failed',
              summaryError: event.payload.error,
              summaryUpdatedAt: event.ts,
            },
            event,
          )
        default: {
          const _exhaustive: never = event
          return _exhaustive
        }
      }
    }
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

export const getConversationStreamStatusLabel = (
  state: ConversationStreamState,
): string | null => {
  if (state.phase === 'error') {
    return state.errorMessage ? `Error: ${state.errorMessage}` : 'Error'
  }

  if (state.phase === 'idle' || state.phase === 'done') {
    return null
  }

  switch (state.stage) {
    case 'loading_context':
      return 'Loading context...'
    case 'retrieving':
      return 'Retrieving context...'
    case 'generating':
      return 'Generating response...'
    case 'summarizing':
      return 'Summarizing response...'
    case 'persisting':
      return 'Saving response...'
    default:
      return 'Sending...'
  }
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseBaseEvent = (value: unknown) => {
  if (!isObjectRecord(value)) {
    return null
  }

  const type = typeof value.type === 'string' ? value.type : null
  const turnId = typeof value.turnId === 'string' ? value.turnId : null
  const seq = typeof value.seq === 'number' ? value.seq : null
  const eventId = value.eventId
  const parsedEventId = eventId === undefined
    ? undefined
    : typeof eventId === 'number' && Number.isInteger(eventId) && eventId > 0
      ? eventId
      : null
  const ts = typeof value.ts === 'string' ? value.ts : null
  const payload = isObjectRecord(value.payload) ? value.payload : null

  if (!type || !turnId || seq === null || !Number.isInteger(seq) || seq <= 0 || !ts || !payload) {
    return null
  }
  if (parsedEventId === null) {
    return null
  }

  return {
    type,
    turnId,
    seq,
    eventId: parsedEventId,
    ts,
    payload,
  }
}

export const parseConversationStreamEvent = (
  rawData: string,
): ConversationStreamEvent | null => {
  let parsedData: unknown
  try {
    parsedData = JSON.parse(rawData)
  } catch {
    return null
  }

  const base = parseBaseEvent(parsedData)
  if (!base) {
    return null
  }

  switch (base.type) {
    case 'turn.started':
      if (base.payload.status !== 'loading_context') {
        return null
      }
      return base as TurnStartedEvent
    case 'turn.status': {
      const stage = base.payload.status
      if (
        stage !== 'loading_context' &&
        stage !== 'retrieving' &&
        stage !== 'generating' &&
        stage !== 'summarizing' &&
        stage !== 'persisting'
      ) {
        return null
      }
      return base as TurnStatusEvent
    }
    case 'token.delta':
      if (typeof base.payload.delta !== 'string') {
        return null
      }
      return base as TokenDeltaEvent
    case 'message.completed':
      if (
        typeof base.payload.messageId !== 'string' ||
        typeof base.payload.content !== 'string'
      ) {
        return null
      }
      return base as MessageCompletedEvent
    case 'turn.error':
      if (
        typeof base.payload.code !== 'string' ||
        typeof base.payload.message !== 'string'
      ) {
        return null
      }
      return base as TurnErrorEvent
    case 'summary.completed':
      if (
        typeof base.payload.jobId !== 'string' ||
        base.payload.jobType !== 'summary' ||
        typeof base.payload.attemptCount !== 'number' ||
        !Number.isInteger(base.payload.attemptCount) ||
        base.payload.attemptCount < 0
      ) {
        return null
      }
      if (
        base.payload.metadata !== undefined &&
        !isObjectRecord(base.payload.metadata)
      ) {
        return null
      }
      return base as SummaryCompletedEvent
    case 'summary.failed':
      if (
        typeof base.payload.jobId !== 'string' ||
        base.payload.jobType !== 'summary' ||
        typeof base.payload.attemptCount !== 'number' ||
        !Number.isInteger(base.payload.attemptCount) ||
        base.payload.attemptCount < 0 ||
        typeof base.payload.terminal !== 'boolean' ||
        typeof base.payload.error !== 'string'
      ) {
        return null
      }
      return base as SummaryFailedEvent
    default:
      return null
  }
}
