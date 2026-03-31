import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import { parseMessageMetadata } from '@branching/shared'
import { trpc } from '../../../trpc'
import type { TreeMessage } from '../../../types/tree'
import { invalidateMessagesByNode } from './mutationInvalidation'
import {
  conversationStreamReducer,
  getConversationStreamStatusLabel,
  initialConversationStreamState,
  parseConversationStreamEvent,
} from './conversationStreamState'

type RouterOutputs = inferRouterOutputs<AppRouter>
type NodeMessage = RouterOutputs['messagesByNode'][number]

const STREAM_COMPLETE_FALLBACK_MS = 750
const STREAM_POSTPROCESS_WINDOW_MS = 15_000

const loggedUnknownMessageRoles = new Set<string>()

const mapMessageRoleToTreeRole = (role: NodeMessage['role']): TreeMessage['role'] => {
  switch (role) {
    case 'user':
      return 'user'
    case 'assistant':
      return 'assistant'
    case 'system':
      return 'assistant'
    default: {
      const rawRole = role as string
      if (!loggedUnknownMessageRoles.has(rawRole)) {
        loggedUnknownMessageRoles.add(rawRole)
        console.warn('[node-conversation] Unknown message role received from API.', {
          role: rawRole,
        })
      }
      const _exhaustiveCheck: never = role
      void _exhaustiveCheck
      return 'assistant'
    }
  }
}

const createIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const upsertNodeMessage = (
  current: NodeMessage[] | undefined,
  incomingMessage: NodeMessage,
): NodeMessage[] => {
  if (!current || current.length === 0) {
    return [incomingMessage]
  }

  if (current.some((message) => message.id === incomingMessage.id)) {
    return current
  }

  return [...current, incomingMessage]
}

type UseNodeConversationParams = {
  nodeId: string | null
  canSendMessages: boolean
  conversationModel: string
}

type MessageUpdatePatch = {
  role?: NodeMessage['role']
  content?: string
}

type PendingMessage = {
  id: string
  role: 'user'
  content: string
  status: 'pending' | 'failed'
}

type UseNodeConversationResult = {
  messages: TreeMessage[]
  pendingMessageIds: Set<string>
  failedMessageIds: Set<string>
  isLoadingMessages: boolean
  isSendingMessage: boolean
  isUpdatingMessage: boolean
  isDeletingMessage: boolean
  isGeneratingResponse: boolean
  streamStatusLabel: string | null
  messagesLoadError: string | null
  messageSendError: string | null
  messageUpdateError: string | null
  messageDeleteError: string | null
  sendMessage: (text: string) => boolean
  updateMessage: (messageId: string, patch: MessageUpdatePatch) => boolean
  deleteMessage: (messageId: string) => boolean
  retryFailedMessage: (messageId: string) => boolean
  dismissFailedMessage: (messageId: string) => void
}

/**
 * Loads and writes node discussion messages via tRPC.
 * Uses conversationSend + SSE stream events for progressive status/output updates.
 */
export const useNodeConversation = ({
  nodeId,
  canSendMessages,
  conversationModel,
}: UseNodeConversationParams) => {
  const utils = trpc.useUtils()
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([])
  const [streamState, dispatchStreamAction] = useReducer(
    conversationStreamReducer,
    initialConversationStreamState,
  )
  const streamStateRef = useRef(streamState)
  const streamSourceRef = useRef<EventSource | null>(null)
  const streamTurnIdRef = useRef<string | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)
  const postprocessWindowTimerRef = useRef<number | null>(null)

  const messagesQuery = trpc.messagesByNode.useQuery(
    { nodeId: nodeId ?? '' },
    { enabled: Boolean(nodeId) },
  )

  const invalidateNodeMessages = async (targetNodeId: string) => {
    await invalidateMessagesByNode(utils.messagesByNode.invalidate, targetNodeId)
  }

  const clearStreamTimers = () => {
    if (fallbackTimerRef.current === null) {
      // no-op
    } else {
      window.clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }

    if (postprocessWindowTimerRef.current !== null) {
      window.clearTimeout(postprocessWindowTimerRef.current)
      postprocessWindowTimerRef.current = null
    }
  }

  const closeTurnStream = useCallback(() => {
    clearStreamTimers()
    if (!streamSourceRef.current) {
      streamTurnIdRef.current = null
      return
    }

    streamSourceRef.current.close()
    streamSourceRef.current = null
    streamTurnIdRef.current = null
  }, [])

  const connectTurnStream = useCallback((turnId: string) => {
    if (streamTurnIdRef.current === turnId && streamSourceRef.current) {
      return
    }

    closeTurnStream()

    const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
    const streamUrl = `${apiBaseUrl}/chat/turns/${encodeURIComponent(turnId)}/stream`
    const source = new EventSource(streamUrl, { withCredentials: true })
    streamSourceRef.current = source
    streamTurnIdRef.current = turnId

    const bindEvent = (
      eventType:
        | 'turn.started'
        | 'turn.status'
        | 'token.delta'
        | 'message.completed'
        | 'turn.error'
        | 'summary.completed'
        | 'summary.failed',
    ) => {
      source.addEventListener(eventType, (event) => {
        if (!(event instanceof MessageEvent)) {
          return
        }

        const parsedEvent = parseConversationStreamEvent(event.data)
        if (!parsedEvent) {
          return
        }

        dispatchStreamAction({
          type: 'eventReceived',
          event: parsedEvent,
        })

        if (
          parsedEvent.type === 'turn.error' ||
          parsedEvent.type === 'summary.completed' ||
          (parsedEvent.type === 'summary.failed' && parsedEvent.payload.terminal)
        ) {
          closeTurnStream()
        }
      })
    }

    bindEvent('turn.started')
    bindEvent('turn.status')
    bindEvent('token.delta')
    bindEvent('message.completed')
    bindEvent('turn.error')
    bindEvent('summary.completed')
    bindEvent('summary.failed')
  }, [closeTurnStream])

  useEffect(() => {
    streamStateRef.current = streamState
  }, [streamState])

  useEffect(() => {
    dispatchStreamAction({ type: 'reset' })
    setPendingMessages([])
    closeTurnStream()
  }, [closeTurnStream, nodeId])

  useEffect(
    () => () => {
      closeTurnStream()
    },
    [closeTurnStream],
  )

  const conversationSendMutation = trpc.conversationSend.useMutation()

  const updateMessageMutation = trpc.messageUpdate.useMutation({
    onMutate: () => ({
      targetNodeId: nodeId,
    }),
    onSuccess: async (_updatedMessage, _input, context) => {
      if (!context?.targetNodeId) {
        return
      }

      await invalidateNodeMessages(context.targetNodeId)
    },
  })
  const deleteMessageMutation = trpc.messageDelete.useMutation({
    onMutate: () => ({
      targetNodeId: nodeId,
    }),
    onSuccess: async (_deletedMessage, _input, context) => {
      if (!context?.targetNodeId) {
        return
      }

      await invalidateNodeMessages(context.targetNodeId)
    },
  })

  const messages = useMemo<TreeMessage[]>(() => {
    const persistedMessages = (messagesQuery.data ?? []).map((message) => ({
      id: message.id,
      role: mapMessageRoleToTreeRole(message.role),
      content: message.content,
      metadata: parseMessageMetadata(message.metadata),
    }))
    const localPendingMessages = pendingMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }))

    const activeStreamingDraft =
      streamState.assistantDraft.length > 0
        ? [{
            id: `stream-${streamState.turnId ?? 'draft'}`,
            role: 'assistant' as const,
            content: streamState.assistantDraft,
          }]
        : []

    return [...persistedMessages, ...localPendingMessages, ...activeStreamingDraft]
  }, [messagesQuery.data, pendingMessages, streamState.assistantDraft, streamState.turnId])

  const pendingMessageIds = useMemo(
    () =>
      new Set(
        pendingMessages
          .filter((message) => message.status === 'pending')
          .map((message) => message.id),
      ),
    [pendingMessages],
  )
  const failedMessageIds = useMemo(
    () =>
      new Set(
        pendingMessages
          .filter((message) => message.status === 'failed')
          .map((message) => message.id),
      ),
    [pendingMessages],
  )

  const queueMessage = (pendingMessage: PendingMessage): boolean => {
    if (!nodeId || !canSendMessages || conversationSendMutation.isPending) {
      return false
    }

    setPendingMessages((current) =>
      current.some((message) => message.id === pendingMessage.id)
        ? current.map((message) =>
            message.id === pendingMessage.id
              ? { ...message, status: 'pending' }
              : message,
          )
        : [...current, pendingMessage],
    )

    conversationSendMutation.reset()
    dispatchStreamAction({ type: 'sendRequested' })

    const idempotencyKey = createIdempotencyKey()
    conversationSendMutation.mutate(
      {
        nodeId,
        text: pendingMessage.content,
        model: conversationModel,
        idempotencyKey,
      },
      {
        onSuccess: async (result, input) => {
          connectTurnStream(result.turnId)
          dispatchStreamAction({
            type: 'turnBound',
            turnId: result.turnId,
          })

          utils.messagesByNode.setData({ nodeId: input.nodeId }, (current) =>
            upsertNodeMessage(current, result.userMessage),
          )
          const assistantMessage = result.assistantMessage
          if (assistantMessage) {
            utils.messagesByNode.setData({ nodeId: input.nodeId }, (current) =>
              upsertNodeMessage(current, assistantMessage),
            )
          }

          setPendingMessages((current) =>
            current.filter((message) => message.id !== pendingMessage.id),
          )

          if (result.error) {
            dispatchStreamAction({
              type: 'sendFailed',
              errorMessage: result.error,
            })
            closeTurnStream()
          } else if (result.status === 'completed') {
            clearStreamTimers()
            fallbackTimerRef.current = window.setTimeout(() => {
              if (streamTurnIdRef.current !== result.turnId) {
                return
              }

              const latestState = streamStateRef.current
              if (latestState.phase !== 'done' && latestState.phase !== 'error') {
                dispatchStreamAction({ type: 'sendCompleted' })
              }
              postprocessWindowTimerRef.current = window.setTimeout(() => {
                if (streamTurnIdRef.current !== result.turnId) {
                  return
                }
                closeTurnStream()
              }, STREAM_POSTPROCESS_WINDOW_MS)
            }, STREAM_COMPLETE_FALLBACK_MS)
          }

          await invalidateNodeMessages(input.nodeId)
        },
        onError: (error) => {
          closeTurnStream()
          dispatchStreamAction({
            type: 'sendFailed',
            errorMessage: error.message,
          })
          setPendingMessages((current) =>
            current.map((message) =>
              message.id === pendingMessage.id
                ? { ...message, status: 'failed' }
                : message,
            ),
          )
        },
      },
    )

    return true
  }

  const sendMessage = (text: string): boolean => {
    const trimmed = text.trim()
    if (!trimmed.length) {
      return false
    }

    return queueMessage({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmed,
      status: 'pending',
    })
  }

  const retryFailedMessage = (messageId: string): boolean => {
    const failedMessage = pendingMessages.find(
      (message) => message.id === messageId && message.status === 'failed',
    )
    if (!failedMessage) {
      return false
    }

    return queueMessage(failedMessage)
  }

  const updateMessage = (messageId: string, patch: MessageUpdatePatch): boolean => {
    if (
      !nodeId ||
      !canSendMessages ||
      updateMessageMutation.isPending ||
      (patch.content === undefined && patch.role === undefined)
    ) {
      return false
    }

    updateMessageMutation.reset()
    updateMessageMutation.mutate({
      id: messageId,
      ...patch,
    })
    return true
  }

  const deleteMessage = (messageId: string): boolean => {
    if (!nodeId || !canSendMessages || deleteMessageMutation.isPending) {
      return false
    }

    deleteMessageMutation.reset()
    deleteMessageMutation.mutate({
      id: messageId,
    })
    return true
  }

  const dismissFailedMessage = (messageId: string) => {
    setPendingMessages((current) =>
      current.filter((message) => message.id !== messageId),
    )
  }

  const result: UseNodeConversationResult = {
    messages,
    pendingMessageIds,
    failedMessageIds,
    isLoadingMessages: messagesQuery.isLoading,
    isSendingMessage:
      conversationSendMutation.isPending || streamState.phase === 'sending',
    isUpdatingMessage: updateMessageMutation.isPending,
    isDeletingMessage: deleteMessageMutation.isPending,
    isGeneratingResponse: streamState.phase === 'generating',
    streamStatusLabel: getConversationStreamStatusLabel(streamState),
    messagesLoadError: messagesQuery.error?.message ?? null,
    messageSendError:
      streamState.errorMessage ?? conversationSendMutation.error?.message ?? null,
    messageUpdateError: updateMessageMutation.error?.message ?? null,
    messageDeleteError: deleteMessageMutation.error?.message ?? null,
    sendMessage,
    updateMessage,
    deleteMessage,
    retryFailedMessage,
    dismissFailedMessage,
  }

  return result
}
