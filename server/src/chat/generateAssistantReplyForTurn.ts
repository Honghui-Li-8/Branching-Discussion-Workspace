import { selectProvider } from './providers/selectProvider.js'
import { emitTokenDeltas } from './providers/tokenDeltas.js'
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
const TEMP_ECHO_ASSISTANT_INPUT = false // debug use echo history
const TEMP_ECHO_CONTEXT_TAIL_COUNT = 10
const TEMP_ECHO_MESSAGE_MAX_CHARS = 600

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

const buildTempEchoContent = (retrievalState: RetrievalStageState): string => {
  const tailMessages = retrievalState.prompt.conversation.slice(-TEMP_ECHO_CONTEXT_TAIL_COUNT)
  const contextTail = tailMessages
    .map((message, i) => {
      const distanceFromPresent = i - tailMessages.length
      const compactContent = message.content.replace(/\s+/g, ' ').trim()
      const preview =
        compactContent.length > TEMP_ECHO_MESSAGE_MAX_CHARS
          ? `${compactContent.slice(0, TEMP_ECHO_MESSAGE_MAX_CHARS)}...`
          : compactContent
      return `- [${distanceFromPresent}] [${message.role}] ${preview}`
    })
    .join('\n')

  return [
    '[TEMP ECHO OVERRIDE]',
    `Current input: ${retrievalState.prompt.currentUserMessage}`,
    'Note: current input is shown above and is not part of "Recent prompt messages".',
    `Prompt history count before budget: ${retrievalState.promptBudgetSummary?.conversationCountBefore ?? retrievalState.prompt.conversation.length}`,
    `Prompt history count after budget: ${retrievalState.prompt.conversation.length}`,
    `Recent prompt messages (${Math.min(TEMP_ECHO_CONTEXT_TAIL_COUNT, retrievalState.prompt.conversation.length)}):`,
    contextTail || '- (none)',
  ].join('\n\n')
}

const generateTempEchoAssistantReply = async ({
  runtime,
  retrievalState,
}: GenerateAssistantReplyForTurnParams): Promise<GenerateAssistantResult> => {
  const echoedContent = buildTempEchoContent(retrievalState)
  await runtime.publishTurnEvent({
    type: 'turn.status',
    payload: {
      status: 'generating',
      detail: 'Generating assistant response.',
    },
  })
  await emitTokenDeltas(echoedContent, async (delta) => {
    await runtime.publishTurnEvent({
      type: 'token.delta',
      payload: {
        delta,
      },
    })
  })
  logger.warn('[llm] temporary echo override enabled; returning current user input as assistant output.', {
    turn_id: runtime.turn.id,
    node_id: runtime.input.nodeId,
    author_user_id: runtime.currentUserId,
  })
  return {
    content: echoedContent,
    finishReason: 'stop',
    providerResponseId: null,
    usage: { inputTokens: null, outputTokens: null, totalTokens: null },
  }
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

  // TEMP DEBUG OVERRIDE:
  // Force assistant output to echo prompt inputs so branch/context behavior
  // can be validated deterministically without model variability.
  if (TEMP_ECHO_ASSISTANT_INPUT) {
    return await generateTempEchoAssistantReply({
      runtime,
      retrievalState,
    })
  }

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
