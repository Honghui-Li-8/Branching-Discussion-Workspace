import type { SendConversationTurnInput, SendConversationTurnResult } from './types.js'
import { createLogger } from '../logging/logger.js'
import {
  type ConversationTurnFlowContext,
  buildConversationTurnFlowContext,
  runTurnFlowPreflight,
  scheduleInputClassificationTask,
} from './turnFlowPreflight.js'
import { buildTurnFlowRuntime } from './turnFlowRuntime.js'
import {
  persistUserMessageOrHandleFailure,
  runTurnPipeline,
} from './turnExecutionPipeline.js'

type RunConversationTurnFlowParams = {
  input: SendConversationTurnInput
  currentUserId: string
  awaitCompletion?: boolean
}

const logger = createLogger('chat-turn-flow')

type TurnPipelineParams = Parameters<typeof runTurnPipeline>[0]

const runTurnPipelineInBackground = ({
  pipelineParams,
  flowContext,
}: {
  pipelineParams: TurnPipelineParams
  flowContext: ConversationTurnFlowContext
}): void => {
  void runTurnPipeline(pipelineParams).catch((error) => {
    logger.debug('[chat-flow] background turn pipeline finished with handled error.', {
      ...flowContext,
      turn_id: pipelineParams.runtime.turn.id,
      error,
    })
  })
}

const buildProcessingResult = ({
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
  const flowContext = buildConversationTurnFlowContext({
    input,
    currentUserId,
  })

  logger.info('[chat-flow] runConversationTurnFlow started.', flowContext)

  // #region: Validation and Idempotent Replay
  const { resolvedTurn, replayResult } = await runTurnFlowPreflight({
    input,
    currentUserId,
    requestStartedAtMs,
  })
  if (replayResult) {
    return replayResult
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

  const userMessage = await persistUserMessageOrHandleFailure({
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
    runTurnPipelineInBackground({
      pipelineParams: turnPipelineParams,
      flowContext,
    })
    const result = buildProcessingResult({
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

  const result = await runTurnPipeline(turnPipelineParams)

  logger.info('[chat-flow] runConversationTurnFlow completed.', {
    ...flowContext,
    turn_id: result.turnId,
    status: result.status,
  })
  return result
}
