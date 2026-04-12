import { selectProvider } from './providers/selectProvider.js'
import { summarizePromptSections } from './promptObservability.js'
import type { ResolvedConversationTurn } from './resolveConversationTurnOrThrow.js'
import { toDebugPreview } from './debugPreview.js'
import type { TurnEventPublisher } from './turnEventPublisher.js'
import type { RetrievalStageState } from './turnContextPipeline.js'
import type {
  GenerateAssistantResult,
  SendConversationTurnInput,
} from './types.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger('chat-turn')

export type TurnGenerationRuntime = {
  input: SendConversationTurnInput
  currentUserId: string
  turn: ResolvedConversationTurn['turn']
  publishTurnEvent: TurnEventPublisher
}

type GenerateAssistantReplyForTurnParams = {
  runtime: TurnGenerationRuntime
  retrievalState: RetrievalStageState
}

export const generateAssistantReplyForTurn = async ({
  runtime,
  retrievalState,
}: GenerateAssistantReplyForTurnParams): Promise<GenerateAssistantResult> => {
  await runtime.publishTurnEvent({
    type: 'turn.status',
    payload: {
      status: 'awaiting_model',
      detail: 'Waiting for model service.',
    },
  })

  const provider = selectProvider({ model: runtime.input.model })
  logger.debug('[llm] provider selected.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    model: runtime.input.model,
    provider: provider.id,
  })
  logger.debug('[llm] provider input prepared.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    model: runtime.input.model,
    provider: provider.id,
    instruction_count: retrievalState.promptBudgetSummary?.instructionCount ?? null,
    conversation_count: retrievalState.prompt.conversation.length,
    retrieval_count: retrievalState.prompt.retrievalContext.length,
    prompt_sections: summarizePromptSections(retrievalState.prompt),
    estimated_tokens_after_budget: retrievalState.promptBudgetSummary?.estimatedTokensAfter ?? null,
    prompt_instruction_count: retrievalState.prompt.instructions.length,
    prompt_conversation_turn_count: retrievalState.prompt.conversation.length,
    prompt_retrieval_chunk_count: retrievalState.prompt.retrievalContext.length,
    prompt_current_user_message_length: retrievalState.prompt.currentUserMessage.length,
    prompt_current_user_message_preview: toDebugPreview(retrievalState.prompt.currentUserMessage),
  })

  let hasPublishedGeneratingStatus = false
  const assistantOutput = await provider.generate({
    model: runtime.input.model,
    prompt: retrievalState.prompt,
    onTokenDelta: async (delta) => {
      if (delta.length === 0) {
        return
      }
      if (!hasPublishedGeneratingStatus) {
        hasPublishedGeneratingStatus = true
        await runtime.publishTurnEvent({
          type: 'turn.status',
          payload: {
            status: 'generating',
            detail: 'Generating assistant response.',
          },
        })
      }
      await runtime.publishTurnEvent({
        type: 'token.delta',
        payload: {
          delta,
        },
      })
    },
  })

  logger.info('[llm] assistant generation completed.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
    provider: provider.id,
    finish_reason: assistantOutput.finishReason,
    provider_response_id: assistantOutput.providerResponseId,
    output_length: assistantOutput.content.length,
  })

  return assistantOutput
}
