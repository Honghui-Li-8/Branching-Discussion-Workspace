import { TRPCError } from '@trpc/server'
import {
  createOrGetConversationPostprocessJobForAuthor as createOrGetConversationPostprocessJobForAuthorRecord,
  createMessageForAuthor as createMessageForAuthorRecord,
  createOrGetConversationTurnForAuthor as createOrGetConversationTurnForAuthorRecord,
  listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord,
  updateConversationTurnForAuthor as updateConversationTurnForAuthorRecord,
} from '../db/index.js'
import { appendConversationTurnEvent as appendConversationTurnEventRecord } from '../db/queries/conversationTurnEvent.js'
import {
  getRagConfig,
  isRagAllowedForTarget,
  validateAllowedModelOrThrow,
  validateProviderRuntimeConfigOrThrow,
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
import { turnEventBroker } from './stream/broker.js'
import {
  createTurnStreamEvent,
  type ChatTurnStreamEventInput,
  TurnEventSequencer,
} from './stream/events.js'
import type {
  SendConversationTurnInput,
  SendConversationTurnResult,
} from './types.js'
import { createLogger } from '../logging/logger.js'

type SendConversationTurnParams = {
  input: SendConversationTurnInput
  currentUserId: string
  awaitCompletion?: boolean
}

const POSTPROCESS_JOB_TYPES = ['summary', 'index'] as const
const logger = createLogger('chat-turn')
const DEBUG_TEXT_PREVIEW_MAX_CHARS = 1_200

const toDebugPreview = (value: string): string =>
  value.length <= DEBUG_TEXT_PREVIEW_MAX_CHARS
    ? value
    : `${value.slice(0, DEBUG_TEXT_PREVIEW_MAX_CHARS)}...`

const findRecoverableUserMessage = (
  messages: Awaited<ReturnType<typeof listMessagesForNodeForAuthorRecord>>,
  text: string,
  turnCreatedAt: string,
) =>
  messages.find(
    (message) =>
      message.role === 'user' &&
      message.content === text &&
      Date.parse(message.createdAt) >= Date.parse(turnCreatedAt),
  ) ?? null

const findRecoverableAssistantMessage = (
  messages: Awaited<ReturnType<typeof listMessagesForNodeForAuthorRecord>>,
  userMessageCreatedAt: string,
) =>
  messages.find(
    (message) =>
      message.role === 'assistant' &&
      Date.parse(message.createdAt) >= Date.parse(userMessageCreatedAt),
  ) ?? null

const markTurnFailed = async (
  turnId: string,
  currentUserId: string,
  errorMessage: string,
): Promise<void> => {
  await updateConversationTurnForAuthorRecord(
    {
      id: turnId,
      status: 'failed',
      error: errorMessage,
    },
    currentUserId,
  )
}

const enqueuePostprocessJobsForTurn = async (
  turnId: string,
  currentUserId: string,
): Promise<void> => {
  for (const jobType of POSTPROCESS_JOB_TYPES) {
    try {
      const result = await createOrGetConversationPostprocessJobForAuthorRecord(
        {
          turnId,
          jobType,
          payload: {},
        },
        currentUserId,
      )
      if (!result) {
        logger.warn('[postprocess] enqueue skipped because turn is not accessible.', {
          turnId,
          jobType,
          currentUserId,
          turn_id: turnId,
          job_type: jobType,
          author_user_id: currentUserId,
        })
      }
    } catch (error) {
      logger.warn('[postprocess] enqueue failed but response path remains successful.', {
        turnId,
        jobType,
        currentUserId,
        turn_id: turnId,
        job_type: jobType,
        author_user_id: currentUserId,
        error,
      })
    }
  }
}

type RetrievalStageState = {
  prompt: ReturnType<typeof buildAssistantPrompt>
  promptBudgetSummary?: ReturnType<typeof applyPromptBudget>['summary']
  assistantMetadata?: Parameters<typeof createMessageForAuthorRecord>[0]['metadata']
  turnMetadata?: NonNullable<
    Parameters<typeof updateConversationTurnForAuthorRecord>[0]['metadata']
  >
}

type TurnEventPublisher = (event: ChatTurnStreamEventInput) => Promise<void>

const createTurnEventPublisher = (
  turnId: string,
  currentUserId: string,
): TurnEventPublisher => {
  const eventSequencer = new TurnEventSequencer(turnId)

  return async (event) => {
    const transientEvent = createTurnStreamEvent(eventSequencer, event)
    let streamEvent = transientEvent

    if (transientEvent.type === 'turn.status') {
      logger.info('[chat-stream] turn.status event queued.', {
        turn_id: turnId,
        author_user_id: currentUserId,
        seq: transientEvent.seq,
        status: transientEvent.payload.status,
        detail: transientEvent.payload.detail ?? null,
      })
    }

    try {
      const persistedEvent = await appendConversationTurnEventRecord({
        turnId,
        seq: transientEvent.seq,
        eventType: transientEvent.type,
        payload: transientEvent.payload,
      })

      if (persistedEvent) {
        streamEvent = {
          ...transientEvent,
          eventId: persistedEvent.id,
          ts: persistedEvent.createdAt,
        }
        if (streamEvent.type === 'turn.status') {
          logger.info('[chat-stream] turn.status event persisted.', {
            turn_id: turnId,
            author_user_id: currentUserId,
            seq: streamEvent.seq,
            event_id: streamEvent.eventId ?? null,
            status: streamEvent.payload.status,
            detail: streamEvent.payload.detail ?? null,
          })
        }
      }
    } catch (error) {
      logger.warn('[chat-stream] Failed to persist turn stream event.', {
        turn_id: turnId,
        author_user_id: currentUserId,
        seq: transientEvent.seq,
        event_type: transientEvent.type,
        error,
      })
    }

    try {
      turnEventBroker.publish({
        turnId,
        authorUserId: currentUserId,
        event: streamEvent,
      })
      if (streamEvent.type === 'turn.status') {
        logger.info('[chat-stream] turn.status event published to broker.', {
          turn_id: turnId,
          author_user_id: currentUserId,
          seq: streamEvent.seq,
          event_id: streamEvent.eventId ?? null,
          status: streamEvent.payload.status,
          detail: streamEvent.payload.detail ?? null,
        })
      }
    } catch (error) {
      logger.warn('[chat-stream] Failed to publish turn event.', {
        turn_id: turnId,
        author_user_id: currentUserId,
        event_type: streamEvent.type,
        error,
      })
    }
  }
}

export const sendConversationTurn = async ({
  input,
  currentUserId,
  awaitCompletion = true,
}: SendConversationTurnParams): Promise<SendConversationTurnResult> => {
  const requestStartedAtMs = Date.now()
  let stage = 'validating'
  logger.info('[chat] sendConversationTurn started.', {
    node_id: input.nodeId,
    author_user_id: currentUserId,
    model: input.model,
    idempotency_key: input.idempotencyKey,
    text_length: input.text.length,
  })
  logger.debug('[chat] sendConversationTurn user input.', {
    node_id: input.nodeId,
    author_user_id: currentUserId,
    model: input.model,
    idempotency_key: input.idempotencyKey,
    text: toDebugPreview(input.text),
  })

  validateAllowedModelOrThrow(input.model)
  validateProviderRuntimeConfigOrThrow(input.model)

  stage = 'creating_turn'
  const turnResult = await createOrGetConversationTurnForAuthorRecord({
    nodeId: input.nodeId,
    authorUserId: currentUserId,
    model: input.model,
    idempotencyKey: input.idempotencyKey,
    status: 'processing',
  })

  if (!turnResult) {
    logger.warn('[chat] sendConversationTurn could not resolve node while creating turn.', {
      node_id: input.nodeId,
      author_user_id: currentUserId,
      model: input.model,
      idempotency_key: input.idempotencyKey,
    })
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  }

  logger.info('[chat] conversation turn resolved.', {
    turn_id: turnResult.turn.id,
    node_id: input.nodeId,
    author_user_id: currentUserId,
    status: turnResult.turn.status,
    was_created: turnResult.wasCreated,
  })

  if (!turnResult.wasCreated) {
    stage = 'recovering_existing_turn'
    const existingNodeMessages = await listMessagesForNodeForAuthorRecord(
      input.nodeId,
      currentUserId,
    )
    const existingUserMessage = findRecoverableUserMessage(
      existingNodeMessages,
      input.text,
      turnResult.turn.createdAt,
    )

    if (!existingUserMessage) {
      logger.warn('[chat] idempotency recovery failed due to missing user message.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        idempotency_key: input.idempotencyKey,
      })
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'A turn already exists for this idempotency key.',
      })
    }
    const existingAssistantMessage = findRecoverableAssistantMessage(
      existingNodeMessages,
      existingUserMessage.createdAt,
    )
    if (existingAssistantMessage) {
      await enqueuePostprocessJobsForTurn(turnResult.turn.id, currentUserId)
    }

    logger.info('[chat] idempotent turn replay completed.', {
      turn_id: turnResult.turn.id,
      node_id: input.nodeId,
      author_user_id: currentUserId,
      has_assistant_message: Boolean(existingAssistantMessage),
      status: turnResult.turn.status,
      duration_ms: Date.now() - requestStartedAtMs,
    })

    return {
      turnId: turnResult.turn.id,
      status: turnResult.turn.status,
      userMessage: existingUserMessage,
      assistantMessage: existingAssistantMessage,
      error: turnResult.turn.error,
    }
  }

  const publishTurnEvent = createTurnEventPublisher(turnResult.turn.id, currentUserId)

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

  let hasMarkedTurnFailed = false
  const markTurnFailedOnce = async (errorMessage: string): Promise<void> => {
    if (hasMarkedTurnFailed) {
      return
    }
    hasMarkedTurnFailed = true
    await markTurnFailed(turnResult.turn.id, currentUserId, errorMessage)
  }

  const handleTurnFailure = async (
    failedStage: string,
    error: unknown,
  ): Promise<never> => {
    if (error instanceof TRPCError) {
      await markTurnFailedOnce(error.message)
      logger.warn('[chat] sendConversationTurn failed with TRPCError.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        stage: failedStage,
        code: error.code,
        message: error.message,
        duration_ms: Date.now() - requestStartedAtMs,
      })
      await publishTurnEvent({
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
      turn_id: turnResult.turn.id,
      node_id: input.nodeId,
      author_user_id: currentUserId,
      stage: failedStage,
      error,
      duration_ms: Date.now() - requestStartedAtMs,
    })
    await publishTurnEvent({
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

  const runTurnPipeline = async (
    userMessage: SendConversationTurnResult['userMessage'],
  ): Promise<SendConversationTurnResult> => {
    let pipelineStage = 'building_context'

    try {
      const contextPreparationStartedAtMs = Date.now()
      logger.info('[chat] context preparation started.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        current_turn_id: turnResult.turn.id,
      })

      logger.info('[chat] context preparation step: loading node and recent message history.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
      })
      const context = await buildConversationContext({
        nodeId: input.nodeId,
        currentUserId,
        userInput: input.text,
        currentTurnId: turnResult.turn.id,
      })
      if (context.memoryPlaceholder) {
        logger.warn('[chat] older conversation context would use a placeholder summary path.', {
          turn_id: turnResult.turn.id,
          node_id: input.nodeId,
          author_user_id: currentUserId,
          placeholder_status: context.memoryPlaceholder.status,
          older_message_count: context.memoryPlaceholder.olderMessageCount,
          retained_message_count: context.memoryPlaceholder.retainedMessageCount,
        })
      }
      logger.debug('[chat] conversation context built.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        workspace_id: context.node.workspaceId,
        recent_messages: context.recentMessages.length,
      })
      logger.info('[chat] context preparation step complete: conversation context assembled.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        workspace_id: context.node.workspaceId,
        recent_messages: context.recentMessages.length,
        has_memory_placeholder: Boolean(context.memoryPlaceholder),
      })

      let retrievalState: RetrievalStageState = {
        prompt: buildAssistantPrompt(context),
      }
      pipelineStage = 'evaluating_rag'
      logger.info('[chat] context preparation step: evaluating retrieval eligibility.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
      })
      const ragConfig = getRagConfig()
      const ragAllowed = isRagAllowedForTarget({
        config: ragConfig,
        userId: currentUserId,
        workspaceId: context.node.workspaceId,
      })
      logger.debug('[rag] retrieval gate evaluated.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        rag_enabled: ragConfig.enabled,
        rag_allowed: ragAllowed,
        retriever: ragConfig.retriever,
        workspace_id: context.node.workspaceId,
      })
      logger.info('[chat] context preparation step complete: retrieval eligibility resolved.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        rag_enabled: ragConfig.enabled,
        rag_allowed: ragAllowed,
        retriever: ragConfig.retriever,
      })

      if (ragAllowed) {
        const retrievalStartedAtMs = Date.now()
        pipelineStage = 'retrieving_context'
        await publishTurnEvent({
          type: 'turn.status',
          payload: {
            status: 'retrieving',
            detail: 'Retrieving relevant context.',
          },
        })

        try {
          const retriever = resolveRetriever({ config: ragConfig })
          logger.debug('[rag] retrieval started.', {
            turn_id: turnResult.turn.id,
            node_id: input.nodeId,
            author_user_id: currentUserId,
            retriever: retriever.id,
            max_chunks: ragConfig.maxChunks,
          })
          const retrievalResult = await retriever.retrieve({
            query: input.text,
            nodeId: input.nodeId,
            authorUserId: currentUserId,
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
              existing: turnResult.turn.metadata,
              snapshot: policyDecision.snapshot,
              diagnostics: policyDecision.diagnostics,
            }),
          }
          logger.debug('[rag] retrieval policy applied.', {
            turn_id: turnResult.turn.id,
            node_id: input.nodeId,
            author_user_id: currentUserId,
            retriever: retriever.id,
            chunks_returned: retrievalResult.chunks.length,
            chunks_selected: policyDecision.selectedChunks.length,
            citations: policyDecision.citations.length,
            snapshot_id: policyDecision.snapshot.id,
          })
          logger.debug('[rag] retrieval details.', {
            turn_id: turnResult.turn.id,
            node_id: input.nodeId,
            author_user_id: currentUserId,
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
            turnId: turnResult.turn.id,
            nodeId: input.nodeId,
            authorUserId: currentUserId,
            retriever: retriever.id,
            ragEnabled: true,
            startedAtMs: retrievalStartedAtMs,
            chunksReturned: retrievalResult.chunks.length,
            chunksSelected: policyDecision.selectedChunks.length,
            citationCount: policyDecision.citations.length,
            snapshotId: policyDecision.snapshot.id,
          })
        } catch (error) {
          logger.warn('[rag] Retrieval failed; continuing with base prompt.', {
            turnId: turnResult.turn.id,
            nodeId: input.nodeId,
            currentUserId,
            turn_id: turnResult.turn.id,
            node_id: input.nodeId,
            author_user_id: currentUserId,
            retriever: ragConfig.retriever,
            error,
          })

          retrievalState = {
            prompt: buildAssistantPrompt(context),
            turnMetadata: buildConversationTurnMetadata({
              existing: turnResult.turn.metadata,
              diagnostics: {
                retriever: ragConfig.retriever,
                query: input.text,
                fallbackReason: 'retrieval_failed',
              },
            }),
          }
          logger.debug('[rag] fallback retrieval diagnostics.', {
            turn_id: turnResult.turn.id,
            node_id: input.nodeId,
            author_user_id: currentUserId,
            retriever: ragConfig.retriever,
            fallback_reason: 'retrieval_failed',
          })
          recordRetrievalTelemetry({
            turnId: turnResult.turn.id,
            nodeId: input.nodeId,
            authorUserId: currentUserId,
            retriever: ragConfig.retriever,
            ragEnabled: true,
            startedAtMs: retrievalStartedAtMs,
            chunksReturned: 0,
            chunksSelected: 0,
            citationCount: 0,
            fallbackReason: 'retrieval_failed',
          })
        }
      }

      logger.info('[chat] context preparation step: applying prompt budget.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
      })
      const promptSectionsBeforeBudget = summarizePromptSections(retrievalState.prompt)
      const budgetedPromptResult = applyPromptBudget(retrievalState.prompt)
      const promptSectionsAfterBudget = summarizePromptSections(budgetedPromptResult.prompt)
      retrievalState = {
        ...retrievalState,
        prompt: budgetedPromptResult.prompt,
        promptBudgetSummary: budgetedPromptResult.summary,
      }
      logger.debug('[chat] prompt budget applied.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
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
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        rag_allowed: ragAllowed,
        prompt_instruction_count: retrievalState.prompt.instructions.length,
        prompt_conversation_turn_count: retrievalState.prompt.conversation.length,
        prompt_retrieval_chunk_count: retrievalState.prompt.retrievalContext.length,
        context_preparation_duration_ms: Date.now() - contextPreparationStartedAtMs,
      })

      pipelineStage = 'generating_assistant_reply'
      await publishTurnEvent({
        type: 'turn.status',
        payload: {
          status: 'awaiting_model',
          detail: 'Waiting for model service.',
        },
      })
      const provider = selectProvider({ model: input.model })
      logger.debug('[llm] provider selected.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        model: input.model,
        provider: provider.id,
      })
      logger.debug('[llm] provider input prepared.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        model: input.model,
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
        model: input.model,
        prompt: retrievalState.prompt,
        onTokenDelta: async (delta) => {
          if (delta.length === 0) {
            return
          }
          if (!hasPublishedGeneratingStatus) {
            hasPublishedGeneratingStatus = true
            await publishTurnEvent({
              type: 'turn.status',
              payload: {
                status: 'generating',
                detail: 'Generating assistant response.',
              },
            })
          }
          await publishTurnEvent({
            type: 'token.delta',
            payload: {
              delta,
            },
          })
        },
      })
      logger.info('[llm] assistant generation completed.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        provider: provider.id,
        finish_reason: assistantOutput.finishReason,
        provider_response_id: assistantOutput.providerResponseId,
        output_length: assistantOutput.content.length,
      })

      pipelineStage = 'persisting_assistant_message'
      await publishTurnEvent({
        type: 'turn.status',
        payload: {
          status: 'persisting',
          detail: 'Persisting assistant response.',
        },
      })
      const assistantMessage = await createMessageForAuthorRecord({
        nodeId: input.nodeId,
        authorUserId: currentUserId,
        turnId: turnResult.turn.id,
        role: 'assistant',
        content: assistantOutput.content,
        ...(retrievalState.assistantMetadata !== undefined
          ? { metadata: retrievalState.assistantMetadata }
          : {}),
      })

      if (assistantMessage === null) {
        await markTurnFailedOnce('Node not found.')
        logger.warn('[chat] failed to persist assistant message because node was not found.', {
          turn_id: turnResult.turn.id,
          node_id: input.nodeId,
          author_user_id: currentUserId,
        })
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Node not found.',
        })
      }

      pipelineStage = 'finalizing_turn'
      const completedAt = new Date().toISOString()
      const finalizedTurn = await updateConversationTurnForAuthorRecord(
        {
          id: turnResult.turn.id,
          status: 'completed',
          error: null,
          completedAt,
          ...(retrievalState.turnMetadata !== undefined
            ? { metadata: retrievalState.turnMetadata }
            : {}),
        },
        currentUserId,
      )

      if (!finalizedTurn) {
        logger.warn('[chat] failed to finalize conversation turn because it was not found.', {
          turn_id: turnResult.turn.id,
          node_id: input.nodeId,
          author_user_id: currentUserId,
        })
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation turn not found.',
        })
      }
      await enqueuePostprocessJobsForTurn(finalizedTurn.id, currentUserId)

      await publishTurnEvent({
        type: 'message.completed',
        payload: {
          messageId: assistantMessage.id,
          content: assistantMessage.content,
        },
      })

      logger.info('[chat] sendConversationTurn completed.', {
        turn_id: finalizedTurn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        status: finalizedTurn.status,
        user_message_id: userMessage.id,
        assistant_message_id: assistantMessage.id,
        duration_ms: Date.now() - requestStartedAtMs,
      })

      return {
        turnId: finalizedTurn.id,
        status: finalizedTurn.status,
        userMessage,
        assistantMessage,
        error: finalizedTurn.error,
      }
    } catch (error) {
      await handleTurnFailure(pipelineStage, error)
    }

    throw new Error('Unreachable runTurnPipeline state')
  }

  const userMessage = await (async (): Promise<SendConversationTurnResult['userMessage']> => {
    try {
      stage = 'persisting_user_message'
      const persistedUserMessage = await createMessageForAuthorRecord({
        nodeId: input.nodeId,
        authorUserId: currentUserId,
        turnId: turnResult.turn.id,
        role: 'user',
        content: input.text,
      })

      if (persistedUserMessage === null) {
        await markTurnFailedOnce('Node not found.')
        logger.warn('[chat] failed to persist user message because node was not found.', {
          turn_id: turnResult.turn.id,
          node_id: input.nodeId,
          author_user_id: currentUserId,
        })
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Node not found.',
        })
      }

      return persistedUserMessage
    } catch (error) {
      await handleTurnFailure(stage, error)
    }

    throw new Error('Unreachable user message persistence state')
  })()

  if (!awaitCompletion) {
    void runTurnPipeline(userMessage).catch((error) => {
      logger.debug('[chat] background turn pipeline finished with handled error.', {
        turn_id: turnResult.turn.id,
        node_id: input.nodeId,
        author_user_id: currentUserId,
        error,
      })
    })

    logger.info('[chat] sendConversationTurn accepted for background processing.', {
      turn_id: turnResult.turn.id,
      node_id: input.nodeId,
      author_user_id: currentUserId,
      status: turnResult.turn.status,
      user_message_id: userMessage.id,
      duration_ms: Date.now() - requestStartedAtMs,
    })

    return {
      turnId: turnResult.turn.id,
      status: turnResult.turn.status,
      userMessage,
      assistantMessage: null,
      error: null,
    }
  }

  return runTurnPipeline(userMessage)
}
