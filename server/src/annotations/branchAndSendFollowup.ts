import type { AppRouterContext } from '@branching/shared'
import { TRPCError } from '@trpc/server'
import {
  createOrGetBranchEventMessageForAuthor,
  getBranchEventMetadataFromRecord,
  getMessageBranchSourceContextForAuthor,
  listMessagesByTurn,
} from '../db/queries/message.js'
import { getConversationTurnByIdempotencyKeyForAuthor } from '../db/index.js'
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

const buildBranchSourceContext = (
  selection: BranchAndSendFollowupInput['selection'],
): string => {
  const normalizedQuote = selection.quote.replace(/\s+/g, ' ').trim()
  if (normalizedQuote.length > 0) {
    return normalizedQuote
  }

  const selectorsQuote = selection.selectorJson.selector
    .map((item) => item.quote.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 0)
    .join(' ')
    .trim()
  return selectorsQuote
}

const getFollowupUserMessage = async (turnId: string) => {
  const turnMessages = await listMessagesByTurn(turnId)
  return (
    turnMessages.find(
      (message) => message.role === 'user' && getBranchEventMetadataFromRecord(message) === null,
    ) ?? null
  )
}

const recoverExistingTurnResultOrThrow = async ({
  input,
  currentUserId,
  branchNodeId,
  branchAnnotationId,
  branchEventMessageId,
  cause,
}: {
  input: BranchAndSendFollowupInput
  currentUserId: string
  branchNodeId: string
  branchAnnotationId: string
  branchEventMessageId: string
  cause: TRPCError
}): Promise<BranchAndSendFollowupResult> => {
  const existingTurn = await getConversationTurnByIdempotencyKeyForAuthor(
    branchNodeId,
    currentUserId,
    `${input.idempotencyKey}:turn`,
  )

  if (!existingTurn) {
    throw cause
  }

  const userFollowupMessage = await getFollowupUserMessage(existingTurn.id)

  logger.info('[annotations] branch-and-send-followup recovered existing turn after idempotent replay.', {
    message_id: input.messageId,
    author_user_id: currentUserId,
    branch_node_id: branchNodeId,
    turn_id: existingTurn.id,
    user_followup_message_id: userFollowupMessage?.id ?? null,
    status: existingTurn.status,
  })

  return {
    branchNodeId,
    annotationId: branchAnnotationId,
    branchEventMessageId,
    userFollowupMessageId: userFollowupMessage?.id ?? null,
    turnId: existingTurn.id,
    status: existingTurn.status,
  }
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

  // Step 1: Create or recover the branch node + annotation using the ':branch' sub-key.
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
  const sourceContext = buildBranchSourceContext(input.selection)

  const branchEventMessage = await createOrGetBranchEventMessageForAuthor({
    nodeId: branchResult.branchNodeId,
    authorUserId: currentUserId,
    content: sourceContext,
    metadata: {
      eventType: 'branch_event',
      sourceNodeId: source.parentNodeId,
      sourceMessageId: input.messageId,
      sourceAnnotationId: input.sourceAnnotationId ?? branchResult.annotation.id,
      sourceContext,
      branchNodeId: branchResult.branchNodeId,
    },
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

  const turnInput = {
    nodeId: branchResult.branchNodeId,
    text: input.text,
    model: input.model,
    idempotencyKey: `${input.idempotencyKey}:turn`,
  }

  try {
    const turnResult = await runConversationTurnFlow({
      input: turnInput,
      currentUserId,
      awaitCompletion: false,
    })

    logger.debug('[annotations] branch-and-send-followup: conversation turn started.', {
      message_id: input.messageId,
      author_user_id: currentUserId,
      branch_node_id: branchResult.branchNodeId,
      turn_id: turnResult.turnId,
      user_followup_message_id: turnResult.userMessage.id,
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
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'CONFLICT') {
      return recoverExistingTurnResultOrThrow({
        input,
        currentUserId,
        branchNodeId: branchResult.branchNodeId,
        branchAnnotationId: branchResult.annotation.id,
        branchEventMessageId: branchEventMessage.id,
        cause: error,
      })
    }

    throw error
  }
}
