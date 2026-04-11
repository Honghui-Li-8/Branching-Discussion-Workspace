import { TRPCError } from '@trpc/server'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  updateConversationTurnForAuthor as updateConversationTurnForAuthorRecord,
} from '../db/index.js'
import { selectProvider } from './providers/selectProvider.js'
import { summarizePromptSections } from './promptObservability.js'
import type {
  ConversationContext,
  SendConversationTurnInput,
  SendConversationTurnResult,
} from './types.js'
import { type ResolvedConversationTurn } from './resolveConversationTurnOrThrow.js'
import { enqueuePostprocessJobsForTurn } from './enqueuePostprocessJobsForTurn.js'
import { createMarkTurnFailedOnce, type MarkTurnFailedOnce } from './turnFailure.js'
import {
  createTurnEventPublisher,
  type TurnEventPublisher,
} from './turnEventPublisher.js'
import { toDebugPreview } from './debugPreview.js'
import {
  applyPromptBudgetStage,
  prepareContextStage,
  runRetrievalStage,
  type RetrievalStageState,
} from './turnContextPipeline.js'
import { createLogger } from '../logging/logger.js'

type SendConversationTurnParams = {
  input: SendConversationTurnInput
  currentUserId: string
  awaitCompletion?: boolean
  prebuiltContext?: ConversationContext
  resolvedTurn: ResolvedConversationTurn
  requestStartedAtMs: number
}

const logger = createLogger('chat-turn')

type ActiveConversationTurn = ResolvedConversationTurn['turn']

type SendConversationTurnRuntime = {
  input: SendConversationTurnInput
  currentUserId: string
  prebuiltContext?: ConversationContext
  turn: ActiveConversationTurn
  requestStartedAtMs: number
  publishTurnEvent: TurnEventPublisher
}

type TurnFailureHandler = (failedStage: string, error: unknown) => Promise<never>

const handleTurnFailure = async ({
  runtime,
  markTurnFailedOnce,
  failedStage,
  error,
}: {
  runtime: SendConversationTurnRuntime
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

const generateAssistantReplyStage = async ({
  runtime,
  retrievalState,
}: {
  runtime: SendConversationTurnRuntime
  retrievalState: RetrievalStageState
}) => {
  await runtime.publishTurnEvent({
    type: 'turn.status',
    payload: {
      status: 'awaiting_model',
      detail: 'Waiting for model service.',
    },
  })
  const provider = selectProvider({ model: runtime.input.model })
  logger.debug('[llm] provider selected.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    model: runtime.input.model,
    provider: provider.id,
  })
  logger.debug('[llm] provider input prepared.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    model: runtime.input.model,
    provider: provider.id,
    instruction_count: retrievalState.promptBudgetSummary?.instructionCount ?? null,
    conversation_count: retrievalState.prompt.conversation.length,
    retrieval_count: retrievalState.prompt.retrievalContext.length,
    prompt_sections: summarizePromptSections(retrievalState.prompt),
    estimated_tokens_after_budget: retrievalState.promptBudgetSummary?.estimatedTokensAfter ?? null,
    prompt_instruction_count: retrievalState.prompt.instructions.length,
    prompt_conversation_turn_count: retrievalState.prompt.conversation.length,
    prompt_retrieval_chunk_count: retrievalState.prompt.retrievalContext.length,
    prompt_current_user_message_length: retrievalState.prompt.currentUserMessage.length,
    prompt_current_user_message_preview: toDebugPreview(
      retrievalState.prompt.currentUserMessage,
    ),
  })

  let hasPublishedGeneratingStatus = false
  const assistantOutput = await provider.generate({
    model: runtime.input.model,
    prompt: retrievalState.prompt,
    onTokenDelta: async (delta) => {
      if (delta.length === 0) {
        return
      }
      if (!hasPublishedGeneratingStatus) {
        hasPublishedGeneratingStatus = true
        await runtime.publishTurnEvent({
          type: 'turn.status',
          payload: {
            status: 'generating',
            detail: 'Generating assistant response.',
          },
        })
      }
      await runtime.publishTurnEvent({
        type: 'token.delta',
        payload: {
          delta,
        },
      })
    },
  })

  logger.info('[llm] assistant generation completed.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    provider: provider.id,
    finish_reason: assistantOutput.finishReason,
    provider_response_id: assistantOutput.providerResponseId,
    output_length: assistantOutput.content.length,
  })
  return assistantOutput
}

const persistUserMessageStage = async ({
  runtime,
  markTurnFailedOnce,
}: {
  runtime: SendConversationTurnRuntime
  markTurnFailedOnce: MarkTurnFailedOnce
}): Promise<SendConversationTurnResult['userMessage']> => {
  const persistedUserMessage = await createMessageForAuthorRecord({
    nodeId: runtime.input.nodeId,
    authorUserId: runtime.currentUserId,
    turnId: runtime.turn.id,
    role: 'user',
    content: runtime.input.text,
  })

  if (persistedUserMessage === null) {
    await markTurnFailedOnce('Node not found.')
    logger.warn('[chat] failed to persist user message because node was not found.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
    })
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  }

  return persistedUserMessage
}

const persistAssistantMessageStage = async ({
  runtime,
  markTurnFailedOnce,
  assistantContent,
  assistantMetadata,
}: {
  runtime: SendConversationTurnRuntime
  markTurnFailedOnce: MarkTurnFailedOnce
  assistantContent: string
  assistantMetadata: RetrievalStageState['assistantMetadata']
}) => {
  await runtime.publishTurnEvent({
    type: 'turn.status',
    payload: {
      status: 'persisting',
      detail: 'Persisting assistant response.',
    },
  })
  const assistantMessage = await createMessageForAuthorRecord({
    nodeId: runtime.input.nodeId,
    authorUserId: runtime.currentUserId,
    turnId: runtime.turn.id,
    role: 'assistant',
    content: assistantContent,
    ...(assistantMetadata !== undefined
      ? { metadata: assistantMetadata }
      : {}),
  })

  if (assistantMessage === null) {
    await markTurnFailedOnce('Node not found.')
    logger.warn('[chat] failed to persist assistant message because node was not found.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
    })
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  }

  return assistantMessage
}

const finalizeTurnStage = async ({
  runtime,
  retrievalState,
  userMessage,
  assistantMessage,
}: {
  runtime: SendConversationTurnRuntime
  retrievalState: RetrievalStageState
  userMessage: SendConversationTurnResult['userMessage']
  assistantMessage: NonNullable<SendConversationTurnResult['assistantMessage']>
}): Promise<SendConversationTurnResult> => {
  const completedAt = new Date().toISOString()
  const finalizedTurn = await updateConversationTurnForAuthorRecord(
    {
      id: runtime.turn.id,
      status: 'completed',
      error: null,
      completedAt,
      ...(retrievalState.turnMetadata !== undefined
        ? { metadata: retrievalState.turnMetadata }
        : {}),
    },
    runtime.currentUserId,
  )

  if (!finalizedTurn) {
    logger.warn('[chat] failed to finalize conversation turn because it was not found.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
    })
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Conversation turn not found.',
    })
  }

  await enqueuePostprocessJobsForTurn(finalizedTurn.id, runtime.currentUserId)

  await runtime.publishTurnEvent({
    type: 'message.completed',
    payload: {
      messageId: assistantMessage.id,
      content: assistantMessage.content,
    },
  })

  logger.info('[chat] sendConversationTurn completed.', {
    turn_id: finalizedTurn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    status: finalizedTurn.status,
    user_message_id: userMessage.id,
    assistant_message_id: assistantMessage.id,
    duration_ms: Date.now() - runtime.requestStartedAtMs,
  })

  return {
    turnId: finalizedTurn.id,
    status: finalizedTurn.status,
    userMessage,
    assistantMessage,
    error: finalizedTurn.error,
  }
}

const runTurnPipeline = async ({
  runtime,
  userMessage,
  markTurnFailedOnce,
  handleFailure,
}: {
  runtime: SendConversationTurnRuntime
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
    const assistantOutput = await generateAssistantReplyStage({
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

export const sendConversationTurn = async ({
  input,
  currentUserId,
  awaitCompletion = true,
  prebuiltContext,
  resolvedTurn,
  requestStartedAtMs,
}: SendConversationTurnParams): Promise<SendConversationTurnResult> => {
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

  const runtime: SendConversationTurnRuntime = {
    input,
    currentUserId,
    prebuiltContext,
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

  const userMessage = await (async (): Promise<SendConversationTurnResult['userMessage']> => {
    try {
      return await persistUserMessageStage({
        runtime,
        markTurnFailedOnce,
      })
    } catch (error) {
      await handleFailure('persisting_user_message', error)
    }

    throw new Error('Unreachable user message persistence state')
  })()

  if (!awaitCompletion) {
    void runTurnPipeline({
      runtime,
      userMessage,
      markTurnFailedOnce,
      handleFailure,
    }).catch((error) => {
      logger.debug('[chat] background turn pipeline finished with handled error.', {
        turn_id: runtime.turn.id,
        node_id: runtime.input.nodeId,
        author_user_id: runtime.currentUserId,
        error,
      })
    })

    logger.info('[chat] sendConversationTurn accepted for background processing.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
      status: runtime.turn.status,
      user_message_id: userMessage.id,
      duration_ms: Date.now() - runtime.requestStartedAtMs,
    })

    return {
      turnId: runtime.turn.id,
      status: runtime.turn.status,
      userMessage,
      assistantMessage: null,
      error: null,
    }
  }

  return runTurnPipeline({
    runtime,
    userMessage,
    markTurnFailedOnce,
    handleFailure,
  })
}
