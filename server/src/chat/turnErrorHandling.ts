import { TRPCError } from '@trpc/server'
import { createLogger } from '../logging/logger.js'
import type { ResolvedConversationTurn } from './resolveConversationTurnOrThrow.js'
import type { MarkTurnFailedOnce } from './turnFailure.js'
import type { TurnEventPublisher } from './turnEventPublisher.js'
import type { SendConversationTurnInput } from './types.js'

const logger = createLogger('chat-turn')

export type TurnErrorHandlingRuntime = {
  input: SendConversationTurnInput
  currentUserId: string
  turn: ResolvedConversationTurn['turn']
  requestStartedAtMs: number
  publishTurnEvent: TurnEventPublisher
}

export const handleTurnFailure = async ({
  runtime,
  markTurnFailedOnce,
  failedStage,
  error,
}: {
  runtime: TurnErrorHandlingRuntime
  markTurnFailedOnce: MarkTurnFailedOnce
  failedStage: string
  error: unknown
}): Promise<never> => {
  if (error instanceof TRPCError) {
    await markTurnFailedOnce(error.message)
    logger.warn('[chat] sendConversationTurn failed with TRPCError.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
      stage: failedStage,
      code: error.code,
      message: error.message,
      duration_ms: Date.now() - runtime.requestStartedAtMs,
    })
    await runtime.publishTurnEvent({
      type: 'turn.error',
      payload: {
        code: error.code,
        message: error.message,
      },
    })
    throw error
  }

  const errorMessage = error instanceof Error
    ? error.message
    : 'Assistant generation failed.'
  await markTurnFailedOnce(errorMessage)
  logger.error('[chat] sendConversationTurn failed with unexpected error.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    stage: failedStage,
    error,
    duration_ms: Date.now() - runtime.requestStartedAtMs,
  })
  await runtime.publishTurnEvent({
    type: 'turn.error',
    payload: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Assistant generation failed.',
    },
  })
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Assistant generation failed.',
  })
}
