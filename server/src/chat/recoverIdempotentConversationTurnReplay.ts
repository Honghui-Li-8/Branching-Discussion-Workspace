import { TRPCError } from '@trpc/server'
import { listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord } from '../db/index.js'
import { createLogger } from '../logging/logger.js'
import type { SendConversationTurnInput, SendConversationTurnResult } from './types.js'
import type { ResolvedConversationTurn } from './resolveConversationTurnOrThrow.js'

const logger = createLogger('chat-turn')

type EnqueuePostprocessJobsForTurn = (
  turnId: string,
  currentUserId: string,
) => Promise<void>

type RecoverIdempotentConversationTurnReplayParams = {
  input: SendConversationTurnInput
  currentUserId: string
  resolvedTurn: ResolvedConversationTurn
  requestStartedAtMs: number
  enqueuePostprocessJobsForTurn: EnqueuePostprocessJobsForTurn
}

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

export const recoverIdempotentConversationTurnReplay = async ({
  input,
  currentUserId,
  resolvedTurn,
  requestStartedAtMs,
  enqueuePostprocessJobsForTurn,
}: RecoverIdempotentConversationTurnReplayParams): Promise<SendConversationTurnResult | null> => {
  if (resolvedTurn.wasCreated) {
    return null
  }

  const existingNodeMessages = await listMessagesForNodeForAuthorRecord(
    input.nodeId,
    currentUserId,
  )
  const existingUserMessage = findRecoverableUserMessage(
    existingNodeMessages,
    input.text,
    resolvedTurn.turn.createdAt,
  )

  if (!existingUserMessage) {
    logger.warn('[chat] idempotency recovery failed due to missing user message.', {
      turn_id: resolvedTurn.turn.id,
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
    await enqueuePostprocessJobsForTurn(resolvedTurn.turn.id, currentUserId)
  }

  logger.info('[chat] idempotent turn replay completed.', {
    turn_id: resolvedTurn.turn.id,
    node_id: input.nodeId,
    author_user_id: currentUserId,
    has_assistant_message: Boolean(existingAssistantMessage),
    status: resolvedTurn.turn.status,
    duration_ms: Date.now() - requestStartedAtMs,
  })

  return {
    turnId: resolvedTurn.turn.id,
    status: resolvedTurn.turn.status,
    userMessage: existingUserMessage,
    assistantMessage: existingAssistantMessage,
    error: resolvedTurn.turn.error,
  }
}
