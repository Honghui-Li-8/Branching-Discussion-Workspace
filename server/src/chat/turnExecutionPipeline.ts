import { generateAssistantReplyForTurn } from './generateAssistantReplyForTurn.js'
import {
  applyPromptBudgetStage,
  prepareContextStage,
  runRetrievalStage,
} from './turnContextPipeline.js'
import {
  finalizeTurnStage,
  persistAssistantMessageStage,
  persistUserMessageStage,
} from './turnPersistencePipeline.js'
import type { ConversationTurnFlowRuntime, TurnFailureHandler } from './turnFlowRuntime.js'
import type { MarkTurnFailedOnce } from './turnFailure.js'
import type { SendConversationTurnResult } from './types.js'

export const persistUserMessageOrHandleFailure = async ({
  runtime,
  markTurnFailedOnce,
  handleFailure,
}: {
  runtime: ConversationTurnFlowRuntime
  markTurnFailedOnce: MarkTurnFailedOnce
  handleFailure: TurnFailureHandler
}): Promise<SendConversationTurnResult['userMessage']> => {
  try {
    return await persistUserMessageStage({
      runtime,
      markTurnFailedOnce,
    })
  } catch (error) {
    await handleFailure('persisting_user_message', error)
  }

  throw new Error('Unreachable user message persistence state')
}

export const runTurnPipeline = async ({
  runtime,
  userMessage,
  markTurnFailedOnce,
  handleFailure,
}: {
  runtime: ConversationTurnFlowRuntime
  userMessage: SendConversationTurnResult['userMessage']
  markTurnFailedOnce: MarkTurnFailedOnce
  handleFailure: TurnFailureHandler
}): Promise<SendConversationTurnResult> => {
  let pipelineStage = 'building_context'

  try {
    const contextStage = await prepareContextStage(runtime)
    pipelineStage = 'retrieving_context'
    const retrievalState = await runRetrievalStage({
      runtime,
      context: contextStage.context,
      retrievalState: contextStage.retrievalState,
      ragConfig: contextStage.ragConfig,
      ragAllowed: contextStage.ragAllowed,
    })
    pipelineStage = 'applying_prompt_budget'
    const budgetedState = applyPromptBudgetStage({
      runtime,
      retrievalState,
      ragAllowed: contextStage.ragAllowed,
      contextPreparationStartedAtMs: contextStage.contextPreparationStartedAtMs,
    })

    pipelineStage = 'generating_assistant_reply'
    const assistantOutput = await generateAssistantReplyForTurn({
      runtime,
      retrievalState: budgetedState,
    })

    pipelineStage = 'persisting_assistant_message'
    const assistantMessage = await persistAssistantMessageStage({
      runtime,
      markTurnFailedOnce,
      assistantContent: assistantOutput.content,
      assistantMetadata: budgetedState.assistantMetadata,
    })

    pipelineStage = 'finalizing_turn'
    return finalizeTurnStage({
      runtime,
      retrievalState: budgetedState,
      userMessage,
      assistantMessage,
    })
  } catch (error) {
    await handleFailure(pipelineStage, error)
  }

  throw new Error('Unreachable runTurnPipeline state')
}
