import { TRPCError } from '@trpc/server'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  createOrGetConversationTurnForAuthor as createOrGetConversationTurnForAuthorRecord,
  listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord,
  updateConversationTurnForAuthor as updateConversationTurnForAuthorRecord,
} from '../db/index.js'

type SendConversationTurnInput = {
  nodeId: string
  text: string
  model: string
  idempotencyKey: string
}

type SendConversationTurnParams = {
  input: SendConversationTurnInput
  currentUserId: string
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

export const sendConversationTurn = async ({
  input,
  currentUserId,
}: SendConversationTurnParams) => {
  const turnResult = await createOrGetConversationTurnForAuthorRecord({
    nodeId: input.nodeId,
    authorUserId: currentUserId,
    model: input.model,
    idempotencyKey: input.idempotencyKey,
    status: 'processing',
  })

  if (!turnResult) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  }

  if (!turnResult.wasCreated) {
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
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'A turn already exists for this idempotency key.',
      })
    }

    return {
      turnId: turnResult.turn.id,
      status: turnResult.turn.status,
      userMessage: existingUserMessage,
      assistantMessage: null,
      error: turnResult.turn.error,
    }
  }

  const userMessage = await createMessageForAuthorRecord({
    nodeId: input.nodeId,
    authorUserId: currentUserId,
    role: 'user',
    content: input.text,
  })

  if (userMessage === null) {
    await updateConversationTurnForAuthorRecord(
      {
        id: turnResult.turn.id,
        status: 'failed',
        error: 'Node not found.',
      },
      currentUserId,
    )
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  }

  const completedAt = new Date().toISOString()
  const finalizedTurn = await updateConversationTurnForAuthorRecord(
    {
      id: turnResult.turn.id,
      status: 'completed',
      error: null,
      completedAt,
    },
    currentUserId,
  )

  if (!finalizedTurn) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Conversation turn not found.',
    })
  }

  return {
    turnId: finalizedTurn.id,
    status: finalizedTurn.status,
    userMessage,
    assistantMessage: null,
    error: finalizedTurn.error,
  }
}
