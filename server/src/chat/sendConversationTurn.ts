import { TRPCError } from '@trpc/server'
import {
  createMessageForAuthor as createMessageForAuthorRecord,
  createOrGetConversationTurnForAuthor as createOrGetConversationTurnForAuthorRecord,
  listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord,
  updateConversationTurnForAuthor as updateConversationTurnForAuthorRecord,
} from '../db/index.js'
import {
  validateAllowedModelOrThrow,
  validateProviderRuntimeConfigOrThrow,
} from './config.js'
import { buildConversationContext } from './buildConversationContext.js'
import { selectProvider } from './providers/selectProvider.js'
import type {
  SendConversationTurnInput,
  SendConversationTurnResult,
} from './types.js'

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

export const sendConversationTurn = async ({
  input,
  currentUserId,
}: SendConversationTurnParams): Promise<SendConversationTurnResult> => {
  validateAllowedModelOrThrow(input.model)
  validateProviderRuntimeConfigOrThrow(input.model)

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
    const existingAssistantMessage = findRecoverableAssistantMessage(
      existingNodeMessages,
      existingUserMessage.createdAt,
    )

    return {
      turnId: turnResult.turn.id,
      status: turnResult.turn.status,
      userMessage: existingUserMessage,
      assistantMessage: existingAssistantMessage,
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
    await markTurnFailed(turnResult.turn.id, currentUserId, 'Node not found.')
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  }

  try {
    const context = await buildConversationContext({
      nodeId: input.nodeId,
      currentUserId,
      userInput: input.text,
    })
    const provider = selectProvider({ model: input.model })
    const assistantOutput = await provider.generate({
      model: input.model,
      context,
    })
    const assistantMessage = await createMessageForAuthorRecord({
      nodeId: input.nodeId,
      authorUserId: currentUserId,
      role: 'assistant',
      content: assistantOutput.content,
    })

    if (assistantMessage === null) {
      await markTurnFailed(turnResult.turn.id, currentUserId, 'Node not found.')
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
      assistantMessage,
      error: finalizedTurn.error,
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error
    }

    const errorMessage = error instanceof Error
      ? error.message
      : 'Assistant generation failed.'
    await markTurnFailed(turnResult.turn.id, currentUserId, errorMessage)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Assistant generation failed.',
    })
  }
}
