import { useMemo } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import { parseMessageMetadata } from '@branching/shared/metadata'
import { trpc } from '../../../trpc'
import type { TreeMessage } from '../../../types/tree'
import { buildBranchConversationSegments } from '../../conversation/branchConversationView'

type RouterOutputs = inferRouterOutputs<AppRouter>
type InheritedMessage = RouterOutputs['inheritedMessagesByNode'][number]

type UseBranchConversationViewParams = {
  nodeId: string | null
  localMessages: TreeMessage[]
}

type UseBranchConversationViewResult = {
  messages: TreeMessage[]
  inheritedMessages: TreeMessage[]
  branchEventMessage: TreeMessage | null
  branchSummaryLabel: string | null
  inheritedMessagesLoadError: string | null
}

const loggedUnknownMessageRoles = new Set<string>()

const mapMessageRoleToTreeRole = (
  role: InheritedMessage['role'],
): TreeMessage['role'] => {
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
        console.warn('[branch-conversation-view] Unknown message role received from API.', {
          role: rawRole,
        })
      }
      const _exhaustiveCheck: never = role
      void _exhaustiveCheck
      return 'assistant'
    }
  }
}

export const useBranchConversationView = ({
  nodeId,
  localMessages,
}: UseBranchConversationViewParams): UseBranchConversationViewResult => {
  const branchEventMetadata = useMemo(
    () =>
      buildBranchConversationSegments({
        inheritedMessages: [],
        localMessages,
      }).branchEventMetadata,
    [localMessages],
  )

  const inheritedMessagesQuery = trpc.inheritedMessagesByNode.useQuery(
    { nodeId: nodeId ?? '' },
    {
      enabled: Boolean(nodeId && branchEventMetadata),
    },
  )

  const inheritedMessages = useMemo<TreeMessage[]>(
    () =>
      (inheritedMessagesQuery.data ?? []).map((message) => ({
        id: message.id,
        role: mapMessageRoleToTreeRole(message.role),
        content: message.content,
        metadata: parseMessageMetadata(message.metadata),
      })),
    [inheritedMessagesQuery.data],
  )

  const branchConversation = useMemo(
    () =>
      buildBranchConversationSegments({
        inheritedMessages,
        localMessages,
      }),
    [inheritedMessages, localMessages],
  )

  return {
    messages: branchConversation.childMessages,
    inheritedMessages: branchConversation.inheritedMessages,
    branchEventMessage: branchConversation.branchEventMessage,
    branchSummaryLabel: branchConversation.branchSummaryLabel,
    inheritedMessagesLoadError: inheritedMessagesQuery.error?.message ?? null,
  }
}
