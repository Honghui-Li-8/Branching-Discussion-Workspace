import { z } from 'zod'

const turnStageSchema = z.enum([
  'loading_context',
  'retrieving',
  'awaiting_model',
  'generating',
  'summarizing',
  'persisting',
])

const streamEventBaseSchema = z.object({
  turnId: z.string().min(1),
  seq: z.number().int().positive(),
  eventId: z.number().int().positive().optional(),
  ts: z.iso.datetime(),
})

const turnStartedEventSchema = streamEventBaseSchema.extend({
  type: z.literal('turn.started'),
  payload: z.object({
    status: z.literal('loading_context'),
  }),
})

const turnStatusEventSchema = streamEventBaseSchema.extend({
  type: z.literal('turn.status'),
  payload: z.object({
    status: turnStageSchema,
    detail: z.string().nullable().optional(),
  }),
})

const tokenDeltaEventSchema = streamEventBaseSchema.extend({
  type: z.literal('token.delta'),
  payload: z.object({
    delta: z.string(),
  }),
})

const messageCompletedEventSchema = streamEventBaseSchema.extend({
  type: z.literal('message.completed'),
  payload: z.object({
    messageId: z.string().min(1),
    content: z.string(),
  }),
})

const turnErrorEventSchema = streamEventBaseSchema.extend({
  type: z.literal('turn.error'),
  payload: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
})

const summaryCompletedEventSchema = streamEventBaseSchema.extend({
  type: z.literal('summary.completed'),
  payload: z.object({
    jobId: z.string().min(1),
    jobType: z.literal('summary'),
    attemptCount: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
})

const summaryFailedEventSchema = streamEventBaseSchema.extend({
  type: z.literal('summary.failed'),
  payload: z.object({
    jobId: z.string().min(1),
    jobType: z.literal('summary'),
    attemptCount: z.number().int().nonnegative(),
    terminal: z.boolean(),
    error: z.string().min(1),
  }),
})

export const chatTurnStreamEventSchema = z.discriminatedUnion('type', [
  turnStartedEventSchema,
  turnStatusEventSchema,
  tokenDeltaEventSchema,
  messageCompletedEventSchema,
  turnErrorEventSchema,
  summaryCompletedEventSchema,
  summaryFailedEventSchema,
])

export type TurnStage = z.infer<typeof turnStageSchema>
export type ChatTurnStreamEvent = z.infer<typeof chatTurnStreamEventSchema>

export type ChatTurnStreamEventInput = Omit<
  ChatTurnStreamEvent,
  'turnId' | 'seq' | 'ts'
>

type CreateEventOptions = {
  at?: Date
}

export class TurnEventSequencer {
  readonly turnId: string
  private seqValue: number

  constructor(turnId: string, startingSeq = 0) {
    if (!turnId || turnId.trim().length === 0) {
      throw new Error('turnId is required')
    }
    if (!Number.isInteger(startingSeq) || startingSeq < 0) {
      throw new Error('startingSeq must be a non-negative integer')
    }

    this.turnId = turnId
    this.seqValue = startingSeq
  }

  get currentSeq(): number {
    return this.seqValue
  }

  nextSeq(): number {
    this.seqValue += 1
    return this.seqValue
  }
}

export const createTurnStreamEvent = (
  sequencer: TurnEventSequencer,
  event: ChatTurnStreamEventInput,
  options: CreateEventOptions = {},
): ChatTurnStreamEvent => {
  const createdEvent = {
    ...event,
    turnId: sequencer.turnId,
    seq: sequencer.nextSeq(),
    ts: (options.at ?? new Date()).toISOString(),
  }

  return chatTurnStreamEventSchema.parse(createdEvent)
}

export const validateChatTurnStreamEvent = (
  event: unknown,
): ChatTurnStreamEvent => chatTurnStreamEventSchema.parse(event)
