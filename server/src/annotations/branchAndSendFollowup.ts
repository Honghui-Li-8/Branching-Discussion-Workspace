import type { AppRouterContext } from '@branching/shared'
import { serializeBranchEventMetadata } from '@branching/shared'
import {
  createMessageForAuthor,
  getMessageBranchSourceContextForAuthor,
} from '../db/queries/message.js'
import { updateConversationTurnForAuthor } from '../db/index.js'
import { runConversationTurnFlow } from '../chat/runConversationTurnFlow.js'
import { resolveConversationTurnOrThrow } from '../chat/resolveConversationTurnOrThrow.js'
import { createLogger } from '../logging/logger.js'
import {
  branchMessageFromSelectionInTransaction,
  MessageBranchSelectionConflictError,
  MessageBranchSelectionInvalidInputError,
} from './branchMessageFromSelection.js'

export { MessageBranchSelectionConflictError, MessageBranchSelectionInvalidInputError }

type BranchAndSendFollowupInput = Parameters<AppRouterContext['branchAndSendFollowup']>[0]
type BranchAndSendFollowupResult = Awaited<ReturnType<AppRouterContext['branchAndSendFollowup']>>

type BranchAndSendFollowupParams = {
  input: BranchAndSendFollowupInput
  currentUserId: string
}

const logger = createLogger('annotations')

const markBackgroundTurnFailed = async ({
  turnId,
  currentUserId,
  error,
}: {
  turnId: string
  currentUserId: string
  error: unknown
}) => {
  const errorMessage = error instanceof Error ? error.message : 'Branch follow-up failed.'
  await updateConversationTurnForAuthor(
    {
      id: turnId,
      status: 'failed',
      error: errorMessage,
    },
    currentUserId,
  )
}

const startBranchFollowupInBackground = ({
  input,
  currentUserId,
  sourceNodeId,
  branchNodeId,
  branchAnnotationId,
  turnId,
}: {
  input: BranchAndSendFollowupInput
  currentUserId: string
  sourceNodeId: string
  branchNodeId: string
  branchAnnotationId: string
  turnId: string
}) => {
  const turnInput = {
    nodeId: branchNodeId,
    text: input.text,
    model: input.model,
    idempotencyKey: `${input.idempotencyKey}:turn`,
  }

  void (async () => {
    try {
      const branchEventMessage = await createMessageForAuthor({
        nodeId: branchNodeId,
        authorUserId: currentUserId,
        role: 'user',
        content: input.sourceContext,
        metadata: serializeBranchEventMetadata({
          eventType: 'branch_event',
          sourceNodeId,
          sourceMessageId: input.messageId,
          sourceAnnotationId: input.sourceAnnotationId ?? branchAnnotationId,
          sourceContext: input.sourceContext,
          branchNodeId,
        }),
      })
      if (!branchEventMessage) {
        throw new Error('Failed to create branch event message in child node.')
      }

      logger.debug('[annotations] branch-and-send-followup: branch event message created.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        branch_node_id: branchNodeId,
        branch_event_message_id: branchEventMessage.id,
      })

      const turnResult = await runConversationTurnFlow({
        input: turnInput,
        currentUserId,
        awaitCompletion: false,
      })

      logger.debug('[annotations] branch-and-send-followup: conversation turn started.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        branch_node_id: branchNodeId,
        turn_id: turnResult.turnId,
        status: turnResult.status,
      })
    } catch (error) {
      await markBackgroundTurnFailed({
        turnId,
        currentUserId,
        error,
      })
      logger.error('[annotations] branch-and-send-followup background work failed.', {
        message_id: input.messageId,
        author_user_id: currentUserId,
        branch_node_id: branchNodeId,
        turn_id: turnId,
        error,
      })
    }
  })()
}

export const branchAndSendFollowup = async ({
  input,
  currentUserId,
}: BranchAndSendFollowupParams): Promise<BranchAndSendFollowupResult | null> => {
  logger.debug('[annotations] branch-and-send-followup started.', {
    message_id: input.messageId,
    author_user_id: currentUserId,
    idempotency_key: input.idempotencyKey,
  })

  // Fetch source context before branching — needed for sourceNodeId in the branch event metadata.
  const source = await getMessageBranchSourceContextForAuthor(input.messageId, currentUserId)
  if (!source) {
    return null
  }

  // Step 1: Create branch node + annotation in a transaction.
  // Idempotency for this step is scoped to the ':branch' sub-key.
  // Full retry-safety across all steps is added in the later idempotency-hardening commit.
  const branchResult = await branchMessageFromSelectionInTransaction({
    input: {
      messageId: input.messageId,
      sourceAnnotationId: input.sourceAnnotationId,
      selection: input.selection,
      annotationKind: input.annotationKind ?? 'branch',
      newNodeMeta: input.newNodeMeta,
      idempotencyKey: `${input.idempotencyKey}:branch`,
    },
    currentUserId,
  })
  if (!branchResult) {
    return null
  }

  logger.debug('[annotations] branch-and-send-followup: branch node created.', {
    message_id: input.messageId,
    author_user_id: currentUserId,
    branch_node_id: branchResult.branchNodeId,
    annotation_id: branchResult.annotation.id,
  })

  const turnInput = {
    nodeId: branchResult.branchNodeId,
    text: input.text,
    model: input.model,
    idempotencyKey: `${input.idempotencyKey}:turn`,
  }
  const resolvedTurn = await resolveConversationTurnOrThrow({
    input: turnInput,
    currentUserId,
  })

  startBranchFollowupInBackground({
    input,
    currentUserId,
    sourceNodeId: source.parentNodeId,
    branchNodeId: branchResult.branchNodeId,
    branchAnnotationId: branchResult.annotation.id,
    turnId: resolvedTurn.turn.id,
  })

  return {
    branchNodeId: branchResult.branchNodeId,
    annotationId: branchResult.annotation.id,
    branchEventMessageId: null,
    userFollowupMessageId: null,
    turnId: resolvedTurn.turn.id,
    status: resolvedTurn.turn.status,
  }
}
