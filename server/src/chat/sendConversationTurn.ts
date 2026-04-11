import { TRPCError } from '@trpc/server'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  updateConversationTurnForAuthor as updateConversationTurnForAuthorRecord,
} from '../db/index.js'
import {
  getRagConfig,
  isRagAllowedForTarget,
} from './config.js'
import { buildConversationContext } from './buildConversationContext.js'
import { buildAssistantPrompt } from './promptBuilder.js'
import { applyPromptBudget } from './promptBudget.js'
import { summarizePromptSections } from './promptObservability.js'
import { selectProvider } from './providers/selectProvider.js'
import { applyContextPolicy } from './rag/contextPolicy.js'
import {
  buildAssistantMessageMetadata,
  buildConversationTurnMetadata,
} from './rag/persistence.js'
import { resolveRetriever } from './rag/retriever.js'
import { recordRetrievalTelemetry } from './rag/telemetry.js'
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

type RetrievalStageState = {
  prompt: ReturnType<typeof buildAssistantPrompt>
  promptBudgetSummary?: ReturnType<typeof applyPromptBudget>['summary']
  assistantMetadata?: Parameters<typeof createMessageForAuthorRecord>[0]['metadata']
  turnMetadata?: NonNullable<
    Parameters<typeof updateConversationTurnForAuthorRecord>[0]['metadata']
  >
}

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

type ContextPreparationStageResult = {
  context: ConversationContext
  retrievalState: RetrievalStageState
  ragConfig: ReturnType<typeof getRagConfig>
  ragAllowed: boolean
  contextPreparationStartedAtMs: number
}

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

const prepareContextStage = async (
  runtime: SendConversationTurnRuntime,
): Promise<ContextPreparationStageResult> => {
  const contextPreparationStartedAtMs = Date.now()
  logger.info('[chat] context preparation started.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    current_turn_id: runtime.turn.id,
  })

  const context = runtime.prebuiltContext
    ?? await buildConversationContext({
      nodeId: runtime.input.nodeId,
      currentUserId: runtime.currentUserId,
      userInput: runtime.input.text,
      currentTurnId: runtime.turn.id,
    })
  if (runtime.prebuiltContext) {
    logger.info('[chat] context preparation step: using prebuilt context from flow orchestrator.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
    })
  } else {
    logger.info('[chat] context preparation step: loading node and recent message history.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
    })
  }
  if (context.memoryPlaceholder) {
    logger.warn('[chat] older conversation context would use a placeholder summary path.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
      placeholder_status: context.memoryPlaceholder.status,
      older_message_count: context.memoryPlaceholder.olderMessageCount,
      retained_message_count: context.memoryPlaceholder.retainedMessageCount,
    })
  }
  logger.debug('[chat] conversation context built.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    workspace_id: context.node.workspaceId,
    recent_messages: context.recentMessages.length,
  })
  logger.info('[chat] context preparation step complete: conversation context assembled.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    workspace_id: context.node.workspaceId,
    recent_messages: context.recentMessages.length,
    has_memory_placeholder: Boolean(context.memoryPlaceholder),
  })

  const retrievalState: RetrievalStageState = {
    prompt: buildAssistantPrompt(context),
  }
  logger.info('[chat] context preparation step: evaluating retrieval eligibility.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
  })
  const ragConfig = getRagConfig()
  const ragAllowed = isRagAllowedForTarget({
    config: ragConfig,
    userId: runtime.currentUserId,
    workspaceId: context.node.workspaceId,
  })
  logger.debug('[rag] retrieval gate evaluated.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    rag_enabled: ragConfig.enabled,
    rag_allowed: ragAllowed,
    retriever: ragConfig.retriever,
    workspace_id: context.node.workspaceId,
  })
  logger.info('[chat] context preparation step complete: retrieval eligibility resolved.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    rag_enabled: ragConfig.enabled,
    rag_allowed: ragAllowed,
    retriever: ragConfig.retriever,
  })

  return {
    context,
    retrievalState,
    ragConfig,
    ragAllowed,
    contextPreparationStartedAtMs,
  }
}

const runRetrievalStage = async ({
  runtime,
  context,
  retrievalState,
  ragConfig,
  ragAllowed,
}: {
  runtime: SendConversationTurnRuntime
  context: ConversationContext
  retrievalState: RetrievalStageState
  ragConfig: ReturnType<typeof getRagConfig>
  ragAllowed: boolean
}): Promise<RetrievalStageState> => {
  if (!ragAllowed) {
    return retrievalState
  }

  const retrievalStartedAtMs = Date.now()
  await runtime.publishTurnEvent({
    type: 'turn.status',
    payload: {
      status: 'retrieving',
      detail: 'Retrieving relevant context.',
    },
  })

  try {
    const retriever = resolveRetriever({ config: ragConfig })
    logger.debug('[rag] retrieval started.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
      retriever: retriever.id,
      max_chunks: ragConfig.maxChunks,
    })
    const retrievalResult = await retriever.retrieve({
      query: runtime.input.text,
      nodeId: runtime.input.nodeId,
      authorUserId: runtime.currentUserId,
      workspaceId: context.node.workspaceId,
      maxChunks: ragConfig.maxChunks,
    })
    const policyDecision = applyContextPolicy(retrievalResult, {
      config: ragConfig,
    })

    retrievalState = {
      prompt: buildAssistantPrompt(context, {
        retrievedChunks: policyDecision.selectedChunks,
      }),
      assistantMetadata: buildAssistantMessageMetadata({
        citations: policyDecision.citations,
      }),
      turnMetadata: buildConversationTurnMetadata({
        existing: runtime.turn.metadata,
        snapshot: policyDecision.snapshot,
        diagnostics: policyDecision.diagnostics,
      }),
    }
    logger.debug('[rag] retrieval policy applied.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
      retriever: retriever.id,
      chunks_returned: retrievalResult.chunks.length,
      chunks_selected: policyDecision.selectedChunks.length,
      citations: policyDecision.citations.length,
      snapshot_id: policyDecision.snapshot.id,
    })
    logger.debug('[rag] retrieval details.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
      retriever: retriever.id,
      diagnostics: retrievalResult.diagnostics,
      returned_chunks: retrievalResult.chunks.map((chunk) => ({
        message_id: chunk.messageId,
        node_id: chunk.nodeId,
        chunk_index: chunk.chunkIndex,
        token_count: chunk.tokenCount,
        score: chunk.score,
        content_preview: toDebugPreview(chunk.content),
      })),
      selected_chunks: policyDecision.selectedChunks.map((chunk) => ({
        message_id: chunk.messageId,
        node_id: chunk.nodeId,
        chunk_index: chunk.chunkIndex,
        token_count: chunk.tokenCount,
        score: chunk.score,
        content_preview: toDebugPreview(chunk.content),
      })),
      citations: policyDecision.citations,
      snapshot: policyDecision.snapshot,
    })
    recordRetrievalTelemetry({
      turnId: runtime.turn.id,
      nodeId: runtime.input.nodeId,
      authorUserId: runtime.currentUserId,
      retriever: retriever.id,
      ragEnabled: true,
      startedAtMs: retrievalStartedAtMs,
      chunksReturned: retrievalResult.chunks.length,
      chunksSelected: policyDecision.selectedChunks.length,
      citationCount: policyDecision.citations.length,
      snapshotId: policyDecision.snapshot.id,
    })
    return retrievalState
  } catch (error) {
    logger.warn('[rag] Retrieval failed; continuing with base prompt.', {
      turnId: runtime.turn.id,
      nodeId: runtime.input.nodeId,
      currentUserId: runtime.currentUserId,
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
      retriever: ragConfig.retriever,
      error,
    })

    retrievalState = {
      prompt: buildAssistantPrompt(context),
      turnMetadata: buildConversationTurnMetadata({
        existing: runtime.turn.metadata,
        diagnostics: {
          retriever: ragConfig.retriever,
          query: runtime.input.text,
          fallbackReason: 'retrieval_failed',
        },
      }),
    }
    logger.debug('[rag] fallback retrieval diagnostics.', {
      turn_id: runtime.turn.id,
      node_id: runtime.input.nodeId,
      author_user_id: runtime.currentUserId,
      retriever: ragConfig.retriever,
      fallback_reason: 'retrieval_failed',
    })
    recordRetrievalTelemetry({
      turnId: runtime.turn.id,
      nodeId: runtime.input.nodeId,
      authorUserId: runtime.currentUserId,
      retriever: ragConfig.retriever,
      ragEnabled: true,
      startedAtMs: retrievalStartedAtMs,
      chunksReturned: 0,
      chunksSelected: 0,
      citationCount: 0,
      fallbackReason: 'retrieval_failed',
    })
    return retrievalState
  }
}

const applyPromptBudgetStage = ({
  runtime,
  retrievalState,
  ragAllowed,
  contextPreparationStartedAtMs,
}: {
  runtime: SendConversationTurnRuntime
  retrievalState: RetrievalStageState
  ragAllowed: boolean
  contextPreparationStartedAtMs: number
}): RetrievalStageState => {
  logger.info('[chat] context preparation step: applying prompt budget.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
  })
  const promptSectionsBeforeBudget = summarizePromptSections(retrievalState.prompt)
  const budgetedPromptResult = applyPromptBudget(retrievalState.prompt)
  const promptSectionsAfterBudget = summarizePromptSections(budgetedPromptResult.prompt)
  const budgetedState: RetrievalStageState = {
    ...retrievalState,
    prompt: budgetedPromptResult.prompt,
    promptBudgetSummary: budgetedPromptResult.summary,
  }
  logger.debug('[chat] prompt budget applied.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    prompt_sections_before_budget: promptSectionsBeforeBudget,
    prompt_sections_after_budget: promptSectionsAfterBudget,
    instruction_count: budgetedPromptResult.summary.instructionCount,
    conversation_count_before: budgetedPromptResult.summary.conversationCountBefore,
    conversation_count_after: budgetedPromptResult.summary.conversationCountAfter,
    retrieval_count_before: budgetedPromptResult.summary.retrievalCountBefore,
    retrieval_count_after: budgetedPromptResult.summary.retrievalCountAfter,
    trimmed_conversation_count: budgetedPromptResult.summary.trimmedConversationCount,
    trimmed_retrieval_count: budgetedPromptResult.summary.trimmedRetrievalCount,
    estimated_tokens_before: budgetedPromptResult.summary.estimatedTokensBefore,
    estimated_tokens_after: budgetedPromptResult.summary.estimatedTokensAfter,
  })
  logger.info('[chat] context preparation completed.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    rag_allowed: ragAllowed,
    prompt_instruction_count: budgetedState.prompt.instructions.length,
    prompt_conversation_turn_count: budgetedState.prompt.conversation.length,
    prompt_retrieval_chunk_count: budgetedState.prompt.retrievalContext.length,
    context_preparation_duration_ms: Date.now() - contextPreparationStartedAtMs,
  })
  return budgetedState
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
