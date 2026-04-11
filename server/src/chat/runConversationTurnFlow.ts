import type { SendConversationTurnInput, SendConversationTurnResult } from './types.js'
import { sendConversationTurn } from './sendConversationTurn.js'
import { scheduleInputClassifier } from './flow/inputClassifier.js'
import { dispatchConversationContextBuild } from './flow/contextDispatch.js'
import { createLogger } from '../logging/logger.js'

type RunConversationTurnFlowParams = {
  input: SendConversationTurnInput
  currentUserId: string
  awaitCompletion?: boolean
}

const logger = createLogger('chat-turn-flow')

export const runConversationTurnFlow = async ({
  input,
  currentUserId,
  awaitCompletion = false,
}: RunConversationTurnFlowParams): Promise<SendConversationTurnResult> => {
  const flowContext = {
    node_id: input.nodeId,
    author_user_id: currentUserId,
    model: input.model,
    idempotency_key: input.idempotencyKey,
  }

  logger.info('[chat-flow] runConversationTurnFlow started.', flowContext)

  // 1) Input Classify (async) @todo, extra for identify explicit summary update request
  const inputClassificationTask = scheduleInputClassifier({ input })
  void inputClassificationTask
    .then((classification) => {
      logger.debug('[chat-flow] input classifier completed.', {
        ...flowContext,
        intent: classification.intent,
        confidence: classification.confidence,
        matched_signals: classification.matchedSignals,
      })
    })
    .catch((error) => {
      logger.warn('[chat-flow] input classifier failed.', {
        ...flowContext,
        error,
      })
    })

  // 2) Context builder
  // 2-1) Pre-build
  let prebuiltContext: Awaited<ReturnType<typeof dispatchConversationContextBuild>> | undefined
  try {
    prebuiltContext = await dispatchConversationContextBuild({
      nodeId: input.nodeId,
      currentUserId,
      userInput: input.text,
    })
    logger.info('[chat-flow] context prebuild completed.', {
      ...flowContext,
      workspace_id: prebuiltContext.node.workspaceId,
      recent_message_count: prebuiltContext.recentMessages.length,
      has_memory_placeholder: Boolean(prebuiltContext.memoryPlaceholder),
    })
  } catch (error) {
    logger.warn('[chat-flow] context prebuild failed; falling back to in-turn context build.', {
      ...flowContext,
      error,
    })
  }

  // Response Generation & Stream
  const result = await sendConversationTurn({
    input,
    currentUserId,
    awaitCompletion,
    prebuiltContext,
  })

  logger.info('[chat-flow] runConversationTurnFlow completed.', {
    ...flowContext,
    turn_id: result.turnId,
    status: result.status,
    used_prebuilt_context: Boolean(prebuiltContext),
  })

  return result
}
