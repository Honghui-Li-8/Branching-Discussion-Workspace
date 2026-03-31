import { TRPCError } from '@trpc/server'
import {
  createOrGetConversationPostprocessJobForAuthor as createOrGetConversationPostprocessJobForAuthorRecord,
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

type SendConversationTurnParams = {
  input: SendConversationTurnInput
  currentUserId: string
}

const POSTPROCESS_JOB_TYPES = ['summary', 'index'] as const

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
        console.warn('[postprocess] enqueue skipped because turn is not accessible.', {
          turnId,
          jobType,
          currentUserId,
        })
      }
    } catch (error) {
      console.warn('[postprocess] enqueue failed but response path remains successful.', {
        turnId,
        jobType,
        currentUserId,
        error,
      })
    }
  }
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
    if (existingAssistantMessage) {
      await enqueuePostprocessJobsForTurn(turnResult.turn.id, currentUserId)
    }

    return {
      turnId: turnResult.turn.id,
      status: turnResult.turn.status,
      userMessage: existingUserMessage,
      assistantMessage: existingAssistantMessage,
      error: turnResult.turn.error,
    }
  }

  const eventSequencer = new TurnEventSequencer(turnResult.turn.id)
  const publishTurnEvent = (event: ChatTurnStreamEventInput): void => {
    try {
      turnEventBroker.publish({
        turnId: turnResult.turn.id,
        authorUserId: currentUserId,
        event: createTurnStreamEvent(eventSequencer, event),
      })
    } catch (error) {
      console.warn('[chat-stream] Failed to publish turn event.', error)
    }
  }

  publishTurnEvent({
    type: 'turn.started',
    payload: {
      status: 'loading_context',
    },
  })
  publishTurnEvent({
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

  try {
    const userMessage = await createMessageForAuthorRecord({
      nodeId: input.nodeId,
      authorUserId: currentUserId,
      role: 'user',
      content: input.text,
    })

    if (userMessage === null) {
      await markTurnFailedOnce('Node not found.')
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Node not found.',
      })
    }

    const context = await buildConversationContext({
      nodeId: input.nodeId,
      currentUserId,
      userInput: input.text,
    })
    publishTurnEvent({
      type: 'turn.status',
      payload: {
        status: 'generating',
        detail: 'Generating assistant response.',
      },
    })
    const provider = selectProvider({ model: input.model })
    const assistantOutput = await provider.generate({
      model: input.model,
      context,
      onTokenDelta: (delta) => {
        if (delta.length === 0) {
          return
        }
        publishTurnEvent({
          type: 'token.delta',
          payload: {
            delta,
          },
        })
      },
    })
    publishTurnEvent({
      type: 'turn.status',
      payload: {
        status: 'persisting',
        detail: 'Persisting assistant response.',
      },
    })
    const assistantMessage = await createMessageForAuthorRecord({
      nodeId: input.nodeId,
      authorUserId: currentUserId,
      role: 'assistant',
      content: assistantOutput.content,
    })

    if (assistantMessage === null) {
      await markTurnFailedOnce('Node not found.')
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
    await enqueuePostprocessJobsForTurn(finalizedTurn.id, currentUserId)

    publishTurnEvent({
      type: 'message.completed',
      payload: {
        messageId: assistantMessage.id,
        content: assistantMessage.content,
      },
    })

    return {
      turnId: finalizedTurn.id,
      status: finalizedTurn.status,
      userMessage,
      assistantMessage,
      error: finalizedTurn.error,
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      await markTurnFailedOnce(error.message)
      publishTurnEvent({
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
    publishTurnEvent({
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
}
