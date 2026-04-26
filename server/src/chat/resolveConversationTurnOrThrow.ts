import { TRPCError } from '@trpc/server'
import { createOrGetConversationTurnForAuthor as createOrGetConversationTurnForAuthorRecord } from '../db/index.js'
import { getNodeByIdForAuthor } from '../db/queries/node.js'
import { createNodeIsMergedError } from '../errors/nodeState.js'
import { createLogger } from '../logging/logger.js'
import type { SendConversationTurnInput } from './types.js'

const logger = createLogger('chat-turn')

export type ResolvedConversationTurn = NonNullable<
  Awaited<ReturnType<typeof createOrGetConversationTurnForAuthorRecord>>
>

type ResolveConversationTurnOrThrowParams = {
  input: SendConversationTurnInput
  currentUserId: string
}

export const resolveConversationTurnOrThrow = async ({
  input,
  currentUserId,
}: ResolveConversationTurnOrThrowParams): Promise<ResolvedConversationTurn> => {
  const resolvedTurn = await createOrGetConversationTurnForAuthorRecord({
    nodeId: input.nodeId,
    authorUserId: currentUserId,
    model: input.model,
    idempotencyKey: input.idempotencyKey,
    status: 'processing',
  })

  if (!resolvedTurn) {
    const node = await getNodeByIdForAuthor(input.nodeId, currentUserId)
    if (node?.status === 'merged') {
      throw createNodeIsMergedError()
    }

    logger.warn('[chat] sendConversationTurn could not resolve node while creating turn.', {
      node_id: input.nodeId,
      author_user_id: currentUserId,
      model: input.model,
      idempotency_key: input.idempotencyKey,
    })
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Node not found.',
    })
  }

  logger.info('[chat] conversation turn resolved.', {
    turn_id: resolvedTurn.turn.id,
    node_id: input.nodeId,
    author_user_id: currentUserId,
    status: resolvedTurn.turn.status,
    was_created: resolvedTurn.wasCreated,
  })

  return resolvedTurn
}
