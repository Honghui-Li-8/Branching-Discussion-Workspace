import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import { parseMessageMetadata } from '@branching/shared/metadata'
import { trpc } from '../../../trpc'
import type { TreeMessage } from '../../../types/tree'
import { invalidateMessagesByNode } from './mutationInvalidation'
import type { BranchFollowupBootstrap } from './useDiscussionTreeUiState'
import {
  conversationStreamReducer,
  type ConversationStreamPhase,
  getConversationStreamStatusLabel,
  initialConversationStreamState,
  parseConversationStreamEvent,
  type TurnStage,
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
  branchFollowupBootstrap?: BranchFollowupBootstrap | null
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
  streamPhase: ConversationStreamPhase
  streamStage: TurnStage | null
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
  branchFollowupBootstrap = null,
}: UseNodeConversationParams) => {
  const utils = trpc.useUtils()
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([])
  const [hiddenPersistedMessageIds, setHiddenPersistedMessageIds] = useState<string[]>([])
  const [streamState, dispatchStreamAction] = useReducer(
    conversationStreamReducer,
    initialConversationStreamState,
  )
  const streamStateRef = useRef(streamState)
  const streamSourceRef = useRef<EventSource | null>(null)
  const streamTurnIdRef = useRef<string | null>(null)
  const streamAuthorUserIdRef = useRef<string | null>(null)
  const streamPendingMessageIdRef = useRef<string | null>(null)
  const streamPersistedMessageIdRef = useRef<string | null>(null)
  const appliedBranchBootstrapKeyRef = useRef<string | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)
  const postprocessWindowTimerRef = useRef<number | null>(null)

  const messagesQuery = trpc.messagesByNode.useQuery(
    { nodeId: nodeId ?? '' },
    { enabled: Boolean(nodeId) },
  )
  const branchFollowupStatusQuery = trpc.branchFollowupStatus.useQuery(
    { turnId: branchFollowupBootstrap?.turnId ?? '' },
    {
      enabled: Boolean(branchFollowupBootstrap?.turnId),
      refetchInterval: (query) => {
        const data = query.state.data
        if (!branchFollowupBootstrap) {
          return false
        }

        return !data || data.status === 'pending' || data.status === 'processing'
          ? 1000
          : false
      },
      refetchOnWindowFocus: false,
    },
  )

  const invalidateNodeMessages = useCallback(async (targetNodeId: string) => {
    await invalidateMessagesByNode(utils.messagesByNode.invalidate, targetNodeId)
  }, [utils.messagesByNode.invalidate])

  const syncHiddenPersistedMessageId = useCallback((nextPersistedMessageId: string | null) => {
    const previousPersistedMessageId = streamPersistedMessageIdRef.current
    streamPersistedMessageIdRef.current = nextPersistedMessageId

    setHiddenPersistedMessageIds((current) => {
      let next = current

      if (
        previousPersistedMessageId
        && previousPersistedMessageId !== nextPersistedMessageId
        && current.includes(previousPersistedMessageId)
      ) {
        next = next.filter((hiddenMessageId) => hiddenMessageId !== previousPersistedMessageId)
      }

      if (nextPersistedMessageId && !next.includes(nextPersistedMessageId)) {
        next = [...next, nextPersistedMessageId]
      }

      return next
    })
  }, [])

  const clearStreamPendingMessage = useCallback((messageId: string) => {
    setPendingMessages((current) =>
      current.filter((message) => message.id !== messageId),
    )
    syncHiddenPersistedMessageId(null)
    if (streamPendingMessageIdRef.current === messageId) {
      streamPendingMessageIdRef.current = null
    }
  }, [syncHiddenPersistedMessageId])

  const markStreamPendingMessageFailed = useCallback((messageId: string) => {
    setPendingMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, status: 'failed' }
          : message,
      ),
    )
    if (streamPendingMessageIdRef.current === messageId) {
      streamPendingMessageIdRef.current = null
    }
  }, [])

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

        if (parsedEvent.type === 'message.completed' && nodeId) {
          utils.messagesByNode.setData({ nodeId }, (current) => {
            const fallbackAuthorUserId = current?.find((message) =>
              message.role === 'user' || message.role === 'assistant'
            )?.authorUserId ?? null
            const authorUserId = streamAuthorUserIdRef.current ?? fallbackAuthorUserId
            if (!authorUserId) {
              return current
            }

            return upsertNodeMessage(current, {
              id: parsedEvent.payload.messageId,
              authorUserId,
              nodeId,
              turnId: parsedEvent.turnId,
              role: 'assistant',
              content: parsedEvent.payload.content,
              createdAt: parsedEvent.ts,
            })
          })

          const pendingStreamMessageId = streamPendingMessageIdRef.current
          if (pendingStreamMessageId) {
            clearStreamPendingMessage(pendingStreamMessageId)
          }

          void invalidateNodeMessages(nodeId)
        }

        dispatchStreamAction({
          type: 'eventReceived',
          event: parsedEvent,
        })

        if (parsedEvent.type === 'turn.error') {
          const pendingStreamMessageId = streamPendingMessageIdRef.current
          if (pendingStreamMessageId) {
            markStreamPendingMessageFailed(pendingStreamMessageId)
          }
        }

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
  }, [
    clearStreamPendingMessage,
    closeTurnStream,
    invalidateNodeMessages,
    markStreamPendingMessageFailed,
    nodeId,
    utils.messagesByNode,
  ])

  useEffect(() => {
    streamStateRef.current = streamState
  }, [streamState])

  useEffect(() => {
    dispatchStreamAction({ type: 'reset' })
    setPendingMessages([])
    setHiddenPersistedMessageIds([])
    streamAuthorUserIdRef.current = null
    streamPendingMessageIdRef.current = null
    streamPersistedMessageIdRef.current = null
    appliedBranchBootstrapKeyRef.current = null
    closeTurnStream()
  }, [closeTurnStream, nodeId])

  useEffect(
    () => () => {
      closeTurnStream()
    },
    [closeTurnStream],
  )

  const resolvedBranchFollowupBootstrap = useMemo(() => {
    if (!branchFollowupBootstrap) {
      return null
    }

    return {
      ...branchFollowupBootstrap,
      status: branchFollowupStatusQuery.data?.status ?? branchFollowupBootstrap.status,
      userFollowupMessageId:
        branchFollowupStatusQuery.data?.userFollowupMessageId
        ?? branchFollowupBootstrap.userFollowupMessageId,
    }
  }, [branchFollowupBootstrap, branchFollowupStatusQuery.data])
  const branchFollowupOverlayMessageId = useMemo(
    () =>
      resolvedBranchFollowupBootstrap
        ? `branch-followup:${resolvedBranchFollowupBootstrap.turnId}`
        : null,
    [resolvedBranchFollowupBootstrap],
  )

  useEffect(() => {
    if (!nodeId || !resolvedBranchFollowupBootstrap || !branchFollowupOverlayMessageId) {
      return
    }

    syncHiddenPersistedMessageId(resolvedBranchFollowupBootstrap.userFollowupMessageId ?? null)
  }, [
    branchFollowupOverlayMessageId,
    nodeId,
    resolvedBranchFollowupBootstrap,
    syncHiddenPersistedMessageId,
  ])

  useEffect(() => {
    if (!nodeId || !resolvedBranchFollowupBootstrap || !branchFollowupOverlayMessageId) {
      return
    }

    const bootstrapKey = [
      nodeId,
      resolvedBranchFollowupBootstrap.turnId,
    ].join(':')
    if (appliedBranchBootstrapKeyRef.current === bootstrapKey) {
      return
    }
    appliedBranchBootstrapKeyRef.current = bootstrapKey

    if (resolvedBranchFollowupBootstrap.status === 'failed') {
      dispatchStreamAction({
        type: 'sendFailed',
        errorMessage:
          branchFollowupStatusQuery.data?.error ?? 'Follow-up generation failed.',
      })
      setPendingMessages((current) => [
        ...current.filter((message) => message.id !== branchFollowupOverlayMessageId),
        {
          id: branchFollowupOverlayMessageId,
          role: 'user',
          content: resolvedBranchFollowupBootstrap.text,
          status: 'failed',
        },
      ])
      return
    }

    if (resolvedBranchFollowupBootstrap.status === 'completed') {
      clearStreamPendingMessage(branchFollowupOverlayMessageId)
      void invalidateNodeMessages(nodeId)
      return
    }

    dispatchStreamAction({ type: 'sendRequested' })
    dispatchStreamAction({
      type: 'turnBound',
      turnId: resolvedBranchFollowupBootstrap.turnId,
    })
    setPendingMessages((current) => [
      ...current.filter((message) => message.id !== branchFollowupOverlayMessageId),
      {
        id: branchFollowupOverlayMessageId,
        role: 'user',
        content: resolvedBranchFollowupBootstrap.text,
        status: 'pending',
      },
    ])
    streamPendingMessageIdRef.current = branchFollowupOverlayMessageId
    connectTurnStream(resolvedBranchFollowupBootstrap.turnId)
    void invalidateNodeMessages(nodeId)
  }, [
    branchFollowupOverlayMessageId,
    branchFollowupStatusQuery.data?.error,
    clearStreamPendingMessage,
    connectTurnStream,
    invalidateNodeMessages,
    nodeId,
    resolvedBranchFollowupBootstrap,
    syncHiddenPersistedMessageId,
  ])

  useEffect(() => {
    if (!nodeId || !resolvedBranchFollowupBootstrap || !branchFollowupOverlayMessageId) {
      return
    }

    if (resolvedBranchFollowupBootstrap.status === 'failed') {
      closeTurnStream()
      dispatchStreamAction({
        type: 'sendFailed',
        errorMessage:
          branchFollowupStatusQuery.data?.error ?? 'Follow-up generation failed.',
      })
      setPendingMessages((current) => [
        ...current.filter((message) => message.id !== branchFollowupOverlayMessageId),
        {
          id: branchFollowupOverlayMessageId,
          role: 'user',
          content: resolvedBranchFollowupBootstrap.text,
          status: 'failed',
        },
      ])
      streamPendingMessageIdRef.current = null
      return
    }

    if (resolvedBranchFollowupBootstrap.status === 'completed') {
      clearStreamPendingMessage(branchFollowupOverlayMessageId)
      void invalidateNodeMessages(nodeId)
      return
    }

    setPendingMessages((current) => [
      ...current.filter((message) => message.id !== branchFollowupOverlayMessageId),
      {
        id: branchFollowupOverlayMessageId,
        role: 'user',
        content: resolvedBranchFollowupBootstrap.text,
        status: 'pending',
      },
    ])
    streamPendingMessageIdRef.current = branchFollowupOverlayMessageId
  }, [
    branchFollowupOverlayMessageId,
    branchFollowupStatusQuery.data?.error,
    clearStreamPendingMessage,
    closeTurnStream,
    invalidateNodeMessages,
    nodeId,
    resolvedBranchFollowupBootstrap,
  ])

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

  const persistedMessages = useMemo<TreeMessage[]>(
    () =>
      (messagesQuery.data ?? [])
        .filter((message) => !hiddenPersistedMessageIds.includes(message.id))
        .map((message) => ({
          id: message.id,
          role: mapMessageRoleToTreeRole(message.role),
          content: message.content,
          metadata: parseMessageMetadata(message.metadata),
        })),
    [hiddenPersistedMessageIds, messagesQuery.data],
  )

  const messages = useMemo<TreeMessage[]>(() => {
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
  }, [pendingMessages, persistedMessages, streamState.assistantDraft, streamState.turnId])

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
          streamAuthorUserIdRef.current = result.userMessage.authorUserId
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
    streamPhase: streamState.phase,
    streamStage: streamState.stage,
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

export type { BranchFollowupBootstrap } from './useDiscussionTreeUiState'
