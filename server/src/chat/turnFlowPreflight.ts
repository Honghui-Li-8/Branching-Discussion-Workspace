import { createLogger } from '../logging/logger.js'
import { validateAllowedModelOrThrow, validateProviderRuntimeConfigOrThrow } from './config.js'
import { enqueuePostprocessJobsForTurn } from './enqueuePostprocessJobsForTurn.js'
import { scheduleInputClassifier } from './flow/inputClassifier.js'
import { recoverIdempotentConversationTurnReplay } from './recoverIdempotentConversationTurnReplay.js'
import { resolveConversationTurnOrThrow } from './resolveConversationTurnOrThrow.js'
import type { SendConversationTurnInput, SendConversationTurnResult } from './types.js'

const logger = createLogger('chat-turn-flow')

export type ConversationTurnFlowContext = {
  node_id: string
  author_user_id: string
  model: string
  idempotency_key: string
}

export const buildConversationTurnFlowContext = ({
  input,
  currentUserId,
}: {
  input: SendConversationTurnInput
  currentUserId: string
}): ConversationTurnFlowContext => ({
  node_id: input.nodeId,
  author_user_id: currentUserId,
  model: input.model,
  idempotency_key: input.idempotencyKey,
})

export const runTurnFlowPreflight = async ({
  input,
  currentUserId,
  requestStartedAtMs,
}: {
  input: SendConversationTurnInput
  currentUserId: string
  requestStartedAtMs: number
}): Promise<{
  resolvedTurnResult: Awaited<ReturnType<typeof resolveConversationTurnOrThrow>>
  replayResult: SendConversationTurnResult | null
}> => {
  // #region: Validation and Idempotent Replay
  validateAllowedModelOrThrow(input.model)
  validateProviderRuntimeConfigOrThrow(input.model)

  const resolvedTurnResult = await resolveConversationTurnOrThrow({
    input,
    currentUserId,
  })
  const replayResult = await recoverIdempotentConversationTurnReplay({
    input,
    currentUserId,
    resolvedTurnResult,
    requestStartedAtMs,
    enqueuePostprocessJobsForTurn,
  })

  // #endregion
  return {
    resolvedTurnResult,
    replayResult,
  }
}

export const scheduleInputClassificationTask = ({
  input,
  flowContext,
}: {
  input: SendConversationTurnInput
  flowContext: ConversationTurnFlowContext
}): void => {
  // #region: 1) Input Classify (async) @todo, extra for identify explicit summary update request
  //    - Kick off classifier in parallel with generation path.
  const inputClassificationTask = scheduleInputClassifier({ input })
  void inputClassificationTask
    .then((classification) => {
      logger.debug('[chat-flow] input classifier completed.', {
        ...flowContext,
        intent: classification.intent,
        confidence: classification.confidence,
        matched_signals: classification.matchedSignals,
      })
    })
    .catch((error) => {
      logger.warn('[chat-flow] input classifier failed.', {
        ...flowContext,
        error,
      })
    })
  // #endregion
}
