import { createLogger } from '../logging/logger.js'
import { getNodeByIdForAuthor } from '../db/queries/node.js'
import { createNodeIsMergedError } from '../errors/nodeState.js'
import { validateAllowedModelOrThrow, validateProviderRuntimeConfigOrThrow } from './config.js'
import { enqueuePostprocessJobsForTurn } from './enqueuePostprocessJobsForTurn.js'
import { scheduleInputClassifier } from './flow/inputClassifier.js'
import { recoverIdempotentConversationTurnReplay } from './recoverIdempotentConversationTurnReplay.js'
import { resolveConversationTurnOrThrow } from './resolveConversationTurnOrThrow.js'
import type { SendConversationTurnInput, SendConversationTurnResult } from './types.js'

const logger = createLogger('chat-turn-flow')

export type TurnFlowContext = {
  node_id: string
  author_user_id: string
  model: string
  idempotency_key: string
}

export const buildTurnFlowContext = ({
  input,
  currentUserId,
}: {
  input: SendConversationTurnInput
  currentUserId: string
}): TurnFlowContext => ({
  node_id: input.nodeId,
  author_user_id: currentUserId,
  model: input.model,
  idempotency_key: input.idempotencyKey,
})

export const runConversationTurnPreflight = async ({
  input,
  currentUserId,
  requestStartedAtMs,
}: {
  input: SendConversationTurnInput
  currentUserId: string
  requestStartedAtMs: number
}): Promise<{
  resolvedTurn: Awaited<ReturnType<typeof resolveConversationTurnOrThrow>>
  idempotentReplay: SendConversationTurnResult | null
}> => {
  // #region: Validation and Idempotent Replay
  validateAllowedModelOrThrow(input.model)
  validateProviderRuntimeConfigOrThrow(input.model)

  const node = await getNodeByIdForAuthor(input.nodeId, currentUserId)
  if (node?.status === 'merged') {
    throw createNodeIsMergedError()
  }

  const resolvedTurn = await resolveConversationTurnOrThrow({
    input,
    currentUserId,
  })
  const idempotentReplay = await recoverIdempotentConversationTurnReplay({
    input,
    currentUserId,
    resolvedTurn,
    requestStartedAtMs,
    enqueuePostprocessJobsForTurn,
  })

  // #endregion
  return {
    resolvedTurn,
    idempotentReplay,
  }
}

export const scheduleInputClassificationTask = ({
  input,
  flowContext,
}: {
  input: SendConversationTurnInput
  flowContext: TurnFlowContext
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
