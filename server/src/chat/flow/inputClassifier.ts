import type { SendConversationTurnInput } from '../types.js'

export type ConversationInputIntent =
  | 'follow_up_discussion'
  | 'direct_action_command'
  | 'mixed_discussion_and_action'
  | 'correction_override'
  | 'operational_request'

export type InputClassificationResult = {
  intent: ConversationInputIntent
  confidence: number
  matchedSignals: string[]
  classifiedAt: string
}

const containsAny = (value: string, patterns: readonly string[]): string[] =>
  patterns.filter((pattern) => value.includes(pattern))

const OPERATIONAL_PATTERNS = ['regenerate', 'retry', 'continue', 'cancel']
const CORRECTION_PATTERNS = ['correction', 'actually', 'update', 'not that']
const ACTION_PATTERNS = ['set ', 'create ', 'delete ', 'mark ', 'approve ', 'apply ']

export const classifyConversationInput = (text: string): InputClassificationResult => {
  const normalized = text.trim().toLowerCase()
  const operationalMatches = containsAny(normalized, OPERATIONAL_PATTERNS)
  if (operationalMatches.length > 0) {
    return {
      intent: 'operational_request',
      confidence: 0.8,
      matchedSignals: operationalMatches,
      classifiedAt: new Date().toISOString(),
    }
  }

  const correctionMatches = containsAny(normalized, CORRECTION_PATTERNS)
  if (correctionMatches.length > 0) {
    return {
      intent: 'correction_override',
      confidence: 0.72,
      matchedSignals: correctionMatches,
      classifiedAt: new Date().toISOString(),
    }
  }

  const actionMatches = containsAny(normalized, ACTION_PATTERNS)
  if (actionMatches.length > 0) {
    const discussionSignals = containsAny(normalized, ['because', 'why', '?'])
    if (discussionSignals.length > 0) {
      return {
        intent: 'mixed_discussion_and_action',
        confidence: 0.68,
        matchedSignals: [...actionMatches, ...discussionSignals],
        classifiedAt: new Date().toISOString(),
      }
    }
    return {
      intent: 'direct_action_command',
      confidence: 0.7,
      matchedSignals: actionMatches,
      classifiedAt: new Date().toISOString(),
    }
  }

  return {
    intent: 'follow_up_discussion',
    confidence: 0.6,
    matchedSignals: [],
    classifiedAt: new Date().toISOString(),
  }
}

export const scheduleInputClassifier = async ({
  input,
}: {
  input: SendConversationTurnInput
}): Promise<InputClassificationResult> => classifyConversationInput(input.text)
