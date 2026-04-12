import type {
  createMessageForAuthor as createMessageForAuthorRecord,
  updateConversationTurnForAuthor as updateConversationTurnForAuthorRecord,
} from '../db/index.js'
import { createLogger } from '../logging/logger.js'
import { buildConversationContext } from './buildConversationContext.js'
import { getRagConfig, isRagAllowedForTarget } from './config.js'
import { applyPromptBudget } from './promptBudget.js'
import { summarizePromptSections } from './promptObservability.js'
import { buildAssistantPrompt } from './promptBuilder.js'
import { applyContextPolicy } from './rag/contextPolicy.js'
import {
  buildAssistantMessageMetadata,
  buildConversationTurnMetadata,
} from './rag/persistence.js'
import { resolveRetriever } from './rag/retriever.js'
import { recordRetrievalTelemetry } from './rag/telemetry.js'
import type { ResolvedConversationTurn } from './resolveConversationTurnOrThrow.js'
import { toDebugPreview } from './debugPreview.js'
import type { TurnEventPublisher } from './turnEventPublisher.js'
import type { ConversationContext, SendConversationTurnInput } from './types.js'

const logger = createLogger('chat-turn')

export type RetrievalStageState = {
  prompt: ReturnType<typeof buildAssistantPrompt>
  promptBudgetSummary?: ReturnType<typeof applyPromptBudget>['summary']
  assistantMetadata?: Parameters<typeof createMessageForAuthorRecord>[0]['metadata']
  turnMetadata?: NonNullable<
    Parameters<typeof updateConversationTurnForAuthorRecord>[0]['metadata']
  >
}

export type ContextPreparationStageResult = {
  context: ConversationContext
  retrievalState: RetrievalStageState
  ragConfig: ReturnType<typeof getRagConfig>
  ragAllowed: boolean
  contextPreparationStartedAtMs: number
}

export type ContextPipelineRuntime = {
  input: SendConversationTurnInput
  currentUserId: string
  prebuiltContext?: ConversationContext
  turn: ResolvedConversationTurn['turn']
  publishTurnEvent: TurnEventPublisher
}

export const prepareContextStage = async (
  runtime: ContextPipelineRuntime,
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

export const runRetrievalStage = async ({
  runtime,
  context,
  retrievalState,
  ragConfig,
  ragAllowed,
}: {
  runtime: ContextPipelineRuntime
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

export const applyPromptBudgetStage = ({
  runtime,
  retrievalState,
  ragAllowed,
  contextPreparationStartedAtMs,
}: {
  runtime: ContextPipelineRuntime
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
