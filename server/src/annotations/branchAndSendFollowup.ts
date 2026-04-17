import type { AppRouterContext } from '@branching/shared'
import { serializeBranchEventMetadata } from '@branching/shared'
import {
  createMessageForAuthor,
  getMessageBranchSourceContextForAuthor,
} from '../db/queries/message.js'
import { runConversationTurnFlow } from '../chat/runConversationTurnFlow.js'
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
  // annotationKind is always 'branch' — suggestion-to-branch conversion is not supported
  // by this mutation (it has no sourceAnnotationId). Idempotency for this step is scoped
  // to the ':branch' sub-key. Full retry-safety across all steps is hardened in Commit 7.
  const branchResult = await branchMessageFromSelectionInTransaction({
    input: {
      messageId: input.messageId,
      selection: input.selection,
      annotationKind: 'branch',
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

  // Step 2: Persist branch event message in the child node.
  // sourceContext is guaranteed non-empty by the input schema.
  // The UI computes a display label from sourceContext in metadata at render time.
  const branchEventMessage = await createMessageForAuthor({
    nodeId: branchResult.branchNodeId,
    authorUserId: currentUserId,
    role: 'user',
    content: input.sourceContext,
    metadata: serializeBranchEventMetadata({
      eventType: 'branch_event',
      sourceNodeId: source.parentNodeId,
      sourceMessageId: input.messageId,
      sourceAnnotationId: branchResult.annotation.id,
      sourceContext: input.sourceContext,
      branchNodeId: branchResult.branchNodeId,
    }),
  })
  if (!branchEventMessage) {
    throw new Error('Failed to create branch event message in child node.')
  }

  logger.debug('[annotations] branch-and-send-followup: branch event message created.', {
    message_id: input.messageId,
    author_user_id: currentUserId,
    branch_node_id: branchResult.branchNodeId,
    branch_event_message_id: branchEventMessage.id,
  })

  // Step 3: Trigger conversation turn pipeline with the follow-up text.
  // Idempotency for this step is scoped to the ':turn' sub-key.
  const turnResult = await runConversationTurnFlow({
    input: {
      nodeId: branchResult.branchNodeId,
      text: input.text,
      model: input.model,
      idempotencyKey: `${input.idempotencyKey}:turn`,
    },
    currentUserId,
    awaitCompletion: false,
  })

  logger.debug('[annotations] branch-and-send-followup: conversation turn started.', {
    message_id: input.messageId,
    author_user_id: currentUserId,
    branch_node_id: branchResult.branchNodeId,
    turn_id: turnResult.turnId,
    status: turnResult.status,
  })

  return {
    branchNodeId: branchResult.branchNodeId,
    annotationId: branchResult.annotation.id,
    branchEventMessageId: branchEventMessage.id,
    userFollowupMessageId: turnResult.userMessage.id,
    turnId: turnResult.turnId,
    status: turnResult.status,
  }
}
