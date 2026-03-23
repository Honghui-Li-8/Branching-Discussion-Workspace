import { useMemo } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import { trpc } from '../../../trpc'
import type { TreeMessage } from '../../../types/tree'

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
  authorUserId: string | null
}

/**
 * Loads and writes node discussion messages via tRPC.
 * Maps backend roles to UI-safe roles and invalidates node message cache after writes.
 */
export const useNodeConversation = ({ nodeId, authorUserId }: UseNodeConversationParams) => {
  const utils = trpc.useUtils()
  const messagesQuery = trpc.messagesByNode.useQuery(
    { nodeId: nodeId ?? '' },
    { enabled: Boolean(nodeId) },
  )

  const invalidateNodeMessages = async (targetNodeId: string) => {
    await utils.messagesByNode.invalidate({ nodeId: targetNodeId })
  }

  const createMessageMutation = trpc.messageCreate.useMutation({
    onSuccess: async (_, input) => {
      await invalidateNodeMessages(input.nodeId)
    },
  })

  const messages = useMemo<TreeMessage[]>(
    () =>
      (messagesQuery.data ?? []).map((message) => ({
        id: message.id,
        role: mapMessageRoleToTreeRole(message.role),
        content: message.content,
      })),
    [messagesQuery.data],
  )

  const sendMessage = (text: string) => {
    if (!nodeId || !authorUserId || createMessageMutation.isPending) {
      return
    }

    const trimmed = text.trim()
    if (!trimmed.length) {
      return
    }

    createMessageMutation.mutate({
      authorUserId,
      nodeId,
      role: 'user',
      content: trimmed,
    })
  }

  return {
    messages,
    isLoadingMessages: messagesQuery.isLoading,
    isSendingMessage: createMessageMutation.isPending,
    messagesError: messagesQuery.error?.message ?? createMessageMutation.error?.message ?? null,
    sendMessage,
  }
}
