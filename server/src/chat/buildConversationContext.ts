import { TRPCError } from '@trpc/server'
import {
  getNodeByIdForAuthor as getNodeByIdForAuthorRecord,
  listMessagesForNodeForAuthor as listMessagesForNodeForAuthorRecord,
} from '../db/index.js'
import type { ConversationContext } from './types.js'

export const DEFAULT_RECENT_MESSAGE_LIMIT = 12
const MIN_RECENT_MESSAGE_LIMIT = 1
const MAX_RECENT_MESSAGE_LIMIT = 50

type BuildConversationContextInput = {
  nodeId: string
  currentUserId: string
  userInput: string
  recentMessageLimit?: number
}

const normalizeRecentMessageLimit = (value?: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_RECENT_MESSAGE_LIMIT
  }

  const rounded = Math.floor(value as number)
  if (rounded < MIN_RECENT_MESSAGE_LIMIT) {
    return DEFAULT_RECENT_MESSAGE_LIMIT
  }

  return Math.min(rounded, MAX_RECENT_MESSAGE_LIMIT)
}

export const buildConversationContext = async ({
  nodeId,
  currentUserId,
  userInput,
  recentMessageLimit,
}: BuildConversationContextInput): Promise<ConversationContext> => {
  const node = await getNodeByIdForAuthorRecord(nodeId, currentUserId)
  if (!node) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  }

  const allMessages = await listMessagesForNodeForAuthorRecord(nodeId, currentUserId)
  const boundedMessages = allMessages.slice(
    -normalizeRecentMessageLimit(recentMessageLimit),
  )

  return {
    node: {
      id: node.id,
      workspaceId: node.workspaceId,
      title: node.title,
      summary: node.summary,
      status: node.status,
      confidence: node.confidence,
      conclusion: node.conclusion,
      rationale: node.rationale,
      depth: node.depth,
      parentNodeId: node.parentNodeId,
    },
    recentMessages: boundedMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })),
    userInput,
  }
}
