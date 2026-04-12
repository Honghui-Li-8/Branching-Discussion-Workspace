import { createMarkTurnFailedOnce, type MarkTurnFailedOnce } from './turnFailure.js'
import { handleTurnFailure } from './turnErrorHandling.js'
import { createTurnEventPublisher } from './turnEventPublisher.js'
import type { ResolvedConversationTurn } from './resolveConversationTurnOrThrow.js'
import type { TurnGenerationRuntime } from './generateAssistantReplyForTurn.js'
import type { SendConversationTurnInput } from './types.js'

export type TurnFlowRuntime = TurnGenerationRuntime & {
  requestStartedAtMs: number
}

export type TurnFailureHandler = (failedStage: string, error: unknown) => Promise<never>

export const buildTurnFlowRuntime = async ({
  input,
  currentUserId,
  resolvedTurn,
  requestStartedAtMs,
}: {
  input: SendConversationTurnInput
  currentUserId: string
  resolvedTurn: ResolvedConversationTurn
  requestStartedAtMs: number
}): Promise<{
  runtime: TurnFlowRuntime
  markTurnFailedOnce: MarkTurnFailedOnce
  handleFailure: TurnFailureHandler
}> => {
  const publishTurnEvent = createTurnEventPublisher(resolvedTurn.turn.id, currentUserId)
  await publishTurnEvent({
    type: 'turn.started',
    payload: {
      status: 'loading_context',
    },
  })
  await publishTurnEvent({
    type: 'turn.status',
    payload: {
      status: 'loading_context',
      detail: 'Building conversation context.',
    },
  })

  const runtime: TurnFlowRuntime = {
    input,
    currentUserId,
    turn: resolvedTurn.turn,
    requestStartedAtMs,
    publishTurnEvent,
  }
  const markTurnFailedOnce = createMarkTurnFailedOnce({
    turnId: runtime.turn.id,
    currentUserId: runtime.currentUserId,
  })
  const handleFailure: TurnFailureHandler = (failedStage, error) =>
    handleTurnFailure({
      runtime,
      markTurnFailedOnce,
      failedStage,
      error,
    })

  return {
    runtime,
    markTurnFailedOnce,
    handleFailure,
  }
}
