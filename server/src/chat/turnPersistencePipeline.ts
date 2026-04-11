import { TRPCError } from '@trpc/server'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  updateConversationTurnForAuthor as updateConversationTurnForAuthorRecord,
} from '../db/index.js'
import { createLogger } from '../logging/logger.js'
import { enqueuePostprocessJobsForTurn } from './enqueuePostprocessJobsForTurn.js'
import type { MarkTurnFailedOnce } from './turnFailure.js'
import type { TurnEventPublisher } from './turnEventPublisher.js'
import type { ResolvedConversationTurn } from './resolveConversationTurnOrThrow.js'
import type { SendConversationTurnInput, SendConversationTurnResult } from './types.js'
import type { RetrievalStageState } from './turnContextPipeline.js'

const logger = createLogger('chat-turn')

export type TurnPersistenceRuntime = {
  input: SendConversationTurnInput
  currentUserId: string
  turn: ResolvedConversationTurn['turn']
  requestStartedAtMs: number
  publishTurnEvent: TurnEventPublisher
}

export const persistUserMessageStage = async ({
  runtime,
  markTurnFailedOnce,
}: {
  runtime: TurnPersistenceRuntime
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

export const persistAssistantMessageStage = async ({
  runtime,
  markTurnFailedOnce,
  assistantContent,
  assistantMetadata,
}: {
  runtime: TurnPersistenceRuntime
  markTurnFailedOnce: MarkTurnFailedOnce
  assistantContent: string
  assistantMetadata: RetrievalStageState['assistantMetadata']
}): Promise<NonNullable<SendConversationTurnResult['assistantMessage']>> => {
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

export const finalizeTurnStage = async ({
  runtime,
  retrievalState,
  userMessage,
  assistantMessage,
}: {
  runtime: TurnPersistenceRuntime
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
