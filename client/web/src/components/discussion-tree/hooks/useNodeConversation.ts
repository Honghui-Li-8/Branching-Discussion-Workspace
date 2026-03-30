import { useMemo, useState } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import { trpc } from '../../../trpc'
import type { TreeMessage } from '../../../types/tree'
import { invalidateMessagesByNode } from './mutationInvalidation'

type RouterOutputs = inferRouterOutputs<AppRouter>
type NodeMessage = RouterOutputs['messagesByNode'][number]

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

type UseNodeConversationParams = {
  nodeId: string | null
  canSendMessages: boolean
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
 * Maps backend roles to UI-safe roles and invalidates node message cache after writes.
 */
export const useNodeConversation = ({ nodeId, canSendMessages }: UseNodeConversationParams) => {
  const utils = trpc.useUtils()
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([])
  const messagesQuery = trpc.messagesByNode.useQuery(
    { nodeId: nodeId ?? '' },
    { enabled: Boolean(nodeId) },
  )

  const invalidateNodeMessages = async (targetNodeId: string) => {
    await invalidateMessagesByNode(utils.messagesByNode.invalidate, targetNodeId)
  }

  const createMessageMutation = trpc.messageCreate.useMutation()
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
    }))
    const localPendingMessages = pendingMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }))

    return [...persistedMessages, ...localPendingMessages]
  }, [messagesQuery.data, pendingMessages])

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
    if (!nodeId || !canSendMessages || createMessageMutation.isPending) {
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
    createMessageMutation.reset()
    createMessageMutation.mutate(
      {
        nodeId,
        role: 'user',
        content: pendingMessage.content,
      },
      {
        onSuccess: async (createdMessage, input) => {
          utils.messagesByNode.setData({ nodeId: input.nodeId }, (current) => {
            if (!current) {
              return [createdMessage]
            }

            if (current.some((message) => message.id === createdMessage.id)) {
              return current
            }

            return [...current, createdMessage]
          })

          setPendingMessages((current) =>
            current.filter((message) => message.id !== pendingMessage.id),
          )

          await invalidateNodeMessages(input.nodeId)
        },
        onError: () => {
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
    isSendingMessage: createMessageMutation.isPending,
    isUpdatingMessage: updateMessageMutation.isPending,
    isDeletingMessage: deleteMessageMutation.isPending,
    messagesLoadError: messagesQuery.error?.message ?? null,
    messageSendError: createMessageMutation.error?.message ?? null,
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
