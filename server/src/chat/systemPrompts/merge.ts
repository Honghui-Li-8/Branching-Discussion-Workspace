import { TRPCError } from '@trpc/server'
import type { ConversationContextMessage, PromptEnvelope } from '../types.js'

const MERGE_RESPONSE_FORMAT_INSTRUCTION = `Response format requirements:
- Return exactly one JSON object.
- The JSON object must have this shape: { "conclusion": "..." }.
- The conclusion value must be a non-empty string.
- Do not wrap the JSON in Markdown.
- Do not add any text before or after the JSON object.`

const MERGE_CONCLUSION_QUALITY_INSTRUCTION = `Merge conclusion requirements:
- Write a concise conclusion that captures the branch outcome.
- Preserve important decisions, tradeoffs, and unresolved caveats from the branch discussion.
- Do not mention that this is a proposal.
- Do not include preamble, acknowledgement, or commentary outside the conclusion text.`

export const MERGE_CONCLUSION_GENERATION_ERROR_MESSAGE = 'Assistant generation failed.'

export type BuildMergeConclusionPromptInput = {
  branchTitle: string
  branchSummary?: string | null
  existingConclusion?: string | null
  messages: ConversationContextMessage[]
}

export type BuildRejectedMergeConclusionPromptInput = BuildMergeConclusionPromptInput & {
  rejectionInstructions: string
}

const buildCommonMergeInstructions = ({
  branchTitle,
  branchSummary,
  existingConclusion,
}: BuildMergeConclusionPromptInput): string[] => [
  `Branch title: ${branchTitle}`,
  `Branch summary: ${branchSummary?.trim() || '(none)'}`,
  `Existing branch conclusion: ${existingConclusion?.trim() || '(none)'}`,
  MERGE_CONCLUSION_QUALITY_INSTRUCTION,
  MERGE_RESPONSE_FORMAT_INSTRUCTION,
]

export const buildInitialMergeConclusionPrompt = (
  input: BuildMergeConclusionPromptInput,
): PromptEnvelope => ({
  instructions: [
    ...buildCommonMergeInstructions(input),
    'Task: propose the conclusion that should be merged back into the parent conversation.',
  ],
  conversation: input.messages,
  currentUserMessage:
    'Create the merge-back conclusion from the branch discussion. Return only the required JSON object.',
  retrievalContext: [],
})

export const buildRejectedMergeConclusionPrompt = (
  input: BuildRejectedMergeConclusionPromptInput,
): PromptEnvelope => ({
  instructions: [
    ...buildCommonMergeInstructions(input),
    'Task: rewrite the merge-back conclusion from scratch using the user rejection instructions.',
    `User rejection instructions: ${input.rejectionInstructions}`,
  ],
  conversation: input.messages,
  currentUserMessage:
    'Create a revised merge-back conclusion from the branch discussion and rejection instructions. Return only the required JSON object.',
  retrievalContext: [],
})

export const createMergeConclusionGenerationError = (): TRPCError =>
  new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: MERGE_CONCLUSION_GENERATION_ERROR_MESSAGE,
  })

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseMergeConclusionOutput = (output: string): string => {
  let parsed: unknown

  try {
    parsed = JSON.parse(output.trim())
  } catch {
    throw createMergeConclusionGenerationError()
  }

  if (!isObjectRecord(parsed) || typeof parsed.conclusion !== 'string') {
    throw createMergeConclusionGenerationError()
  }

  const conclusion = parsed.conclusion.trim()
  if (conclusion.length === 0) {
    throw createMergeConclusionGenerationError()
  }

  return conclusion
}
