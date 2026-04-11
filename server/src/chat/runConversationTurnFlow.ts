import type {
  SendConversationTurnInput,
  SendConversationTurnResult,
} from "./types.js";
import { sendConversationTurn } from "./sendConversationTurn.js";
import { scheduleInputClassifier } from "./flow/inputClassifier.js";
import { createLogger } from "../logging/logger.js";
import {
  validateAllowedModelOrThrow,
  validateProviderRuntimeConfigOrThrow,
} from "./config.js";
import { resolveConversationTurnOrThrow } from "./resolveConversationTurnOrThrow.js";
import { recoverIdempotentConversationTurnReplay } from "./recoverIdempotentConversationTurnReplay.js";
import { enqueuePostprocessJobsForTurn } from "./enqueuePostprocessJobsForTurn.js";

type RunConversationTurnFlowParams = {
  input: SendConversationTurnInput;
  currentUserId: string;
  awaitCompletion?: boolean;
};

const logger = createLogger("chat-turn-flow");

export const runConversationTurnFlow = async ({
  input,
  currentUserId,
  awaitCompletion = false,
}: RunConversationTurnFlowParams): Promise<SendConversationTurnResult> => {
  const requestStartedAtMs = Date.now();
  const flowContext = {
    node_id: input.nodeId,
    author_user_id: currentUserId,
    model: input.model,
    idempotency_key: input.idempotencyKey,
  };

  logger.info("[chat-flow] runConversationTurnFlow started.", flowContext);

  // #region: Validation and Idempotent Replay
  validateAllowedModelOrThrow(input.model);
  validateProviderRuntimeConfigOrThrow(input.model);
  const resolvedTurnResult = await resolveConversationTurnOrThrow({
    input,
    currentUserId,
  });
  const replayResult = await recoverIdempotentConversationTurnReplay({
    input,
    currentUserId,
    resolvedTurnResult,
    requestStartedAtMs,
    enqueuePostprocessJobsForTurn,
  });
  if (replayResult) {
    return replayResult;
  }
  // #endregion

  // #region: 1) Input Classify (async) @todo, extra for identify explicit summary update request
  //    - Kick off classifier in parallel with generation path.
  const inputClassificationTask = scheduleInputClassifier({ input });
  void inputClassificationTask
    .then((classification) => {
      logger.debug("[chat-flow] input classifier completed.", {
        ...flowContext,
        intent: classification.intent,
        confidence: classification.confidence,
        matched_signals: classification.matchedSignals,
      });
    })
    .catch((error) => {
      logger.warn("[chat-flow] input classifier failed.", {
        ...flowContext,
        error,
      });
    });
  // #endregion

  // generation flow
  const result = await sendConversationTurn({
    input,
    currentUserId,
    awaitCompletion,
    resolvedTurn: resolvedTurnResult,
    requestStartedAtMs,
  });

  logger.info("[chat-flow] runConversationTurnFlow completed.", {
    ...flowContext,
    turn_id: result.turnId,
    status: result.status,
  });

  return result;
};
