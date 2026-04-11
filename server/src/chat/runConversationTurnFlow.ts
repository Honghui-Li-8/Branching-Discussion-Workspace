import type { SendConversationTurnInput, SendConversationTurnResult } from './types.js'
import { sendConversationTurn } from './sendConversationTurn.js'
import { scheduleInputClassifier } from './flow/inputClassifier.js'
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

  // 2) Response Generation & Stream
  const result = await sendConversationTurn({
    input,
    currentUserId,
    awaitCompletion,
  })

  logger.info('[chat-flow] runConversationTurnFlow completed.', {
    ...flowContext,
    turn_id: result.turnId,
    status: result.status,
  })

  return result
}
