import { TRPCError } from '@trpc/server'
import type { SendConversationTurnInput, SendConversationTurnResult } from './types.js'
import { createLogger } from '../logging/logger.js'
import {
  type TurnFlowContext,
  buildTurnFlowContext,
  runConversationTurnPreflight,
  scheduleInputClassificationTask,
} from './turnFlowPreflight.js'
import { buildTurnFlowRuntime } from './turnFlowRuntime.js'
import {
  executeTurnPipeline,
  persistUserMessageWithFailureHandling,
} from './turnExecutionPipeline.js'
import { getCreditBalance } from '../db/index.js'

type RunConversationTurnFlowParams = {
  input: SendConversationTurnInput
  currentUserId: string
  awaitCompletion?: boolean
}

const logger = createLogger('chat-turn-flow')

type TurnPipelineParams = Parameters<typeof executeTurnPipeline>[0]

const startTurnPipelineInBackground = ({
  pipelineParams,
  flowContext,
}: {
  pipelineParams: TurnPipelineParams
  flowContext: TurnFlowContext
}): void => {
  void executeTurnPipeline(pipelineParams).catch((error) => {
    logger.debug('[chat-flow] background turn pipeline finished with handled error.', {
      ...flowContext,
      turn_id: pipelineParams.runtime.turn.id,
      error,
    })
  })
}

const buildProcessingTurnResult = ({
  runtime,
  userMessage,
}: {
  runtime: TurnPipelineParams['runtime']
  userMessage: SendConversationTurnResult['userMessage']
}): SendConversationTurnResult => ({
  turnId: runtime.turn.id,
  status: runtime.turn.status,
  userMessage,
  assistantMessage: null,
  error: null,
})

export const runConversationTurnFlow = async ({
  input,
  currentUserId,
  awaitCompletion = false,
}: RunConversationTurnFlowParams): Promise<SendConversationTurnResult> => {
  const requestStartedAtMs = Date.now()
  const flowContext = buildTurnFlowContext({
    input,
    currentUserId,
  })

  logger.info('[chat-flow] runConversationTurnFlow started.', flowContext)

  // #region: Validation and Idempotent Replay
  const { resolvedTurn, idempotentReplay } = await runConversationTurnPreflight({
    input,
    currentUserId,
    requestStartedAtMs,
  })
  if (idempotentReplay) {
    return idempotentReplay
  }
  // #endregion

  // #region: Credit guard
  const balance = await getCreditBalance(currentUserId)
  if (balance <= 0) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'INSUFFICIENT_CREDITS' })
  }
  // #endregion

  // #region: 1) Input Classify (async) @todo, extra for identify explicit summary update request
  //    - Kick off classifier in parallel with generation path.
  scheduleInputClassificationTask({
    input,
    flowContext,
  })
  // #endregion

  const {
    runtime,
    markTurnFailedOnce,
    handleFailure,
  } = await buildTurnFlowRuntime({
    input,
    currentUserId,
    resolvedTurn,
    requestStartedAtMs,
  })

  const userMessage = await persistUserMessageWithFailureHandling({
    runtime,
    markTurnFailedOnce,
    handleFailure,
  })
  const turnPipelineParams: TurnPipelineParams = {
    runtime,
    userMessage,
    markTurnFailedOnce,
    handleFailure,
  }

  if (!awaitCompletion) {
    startTurnPipelineInBackground({
      pipelineParams: turnPipelineParams,
      flowContext,
    })
    const result = buildProcessingTurnResult({
      runtime,
      userMessage,
    })
    logger.info('[chat-flow] runConversationTurnFlow completed.', {
      ...flowContext,
      turn_id: result.turnId,
      status: result.status,
    })
    return result
  }

  const result = await executeTurnPipeline(turnPipelineParams)

  logger.info('[chat-flow] runConversationTurnFlow completed.', {
    ...flowContext,
    turn_id: result.turnId,
    status: result.status,
  })
  return result
}
