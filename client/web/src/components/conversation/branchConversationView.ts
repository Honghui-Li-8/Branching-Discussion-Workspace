import { parseBranchEventMetadata, type BranchEventMetadata } from '@branching/shared'
import type { TreeMessage } from '../../types/tree'

type BranchConversationSegments = {
  inheritedMessages: TreeMessage[]
  branchEventMessage: TreeMessage | null
  childMessages: TreeMessage[]
  branchEventMetadata: BranchEventMetadata | null
  branchSummaryLabel: string | null
}

const BRANCH_SUMMARY_FULL_WORD_LIMIT = 20
const BRANCH_SUMMARY_HEAD_WORD_COUNT = 10
const BRANCH_SUMMARY_TAIL_WORD_COUNT = 6

const splitWords = (value: string): string[] =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

export const summarizeBranchSourceContext = (value: string): string => {
  const words = splitWords(value)
  if (words.length <= BRANCH_SUMMARY_FULL_WORD_LIMIT) {
    return words.join(' ')
  }

  const head = words.slice(0, BRANCH_SUMMARY_HEAD_WORD_COUNT).join(' ')
  const tail = words.slice(-BRANCH_SUMMARY_TAIL_WORD_COUNT).join(' ')
  return `${head} … ${tail}`
}

const getBranchEventMetadata = (message: TreeMessage): BranchEventMetadata | null =>
  parseBranchEventMetadata(message.metadata)

export const getBranchSummaryLabelForMessage = (
  message: TreeMessage,
): string | null => {
  const branchEventMetadata = getBranchEventMetadata(message)
  if (!branchEventMetadata?.sourceContext) {
    return null
  }

  return summarizeBranchSourceContext(branchEventMetadata.sourceContext)
}

export const buildBranchConversationSegments = ({
  inheritedMessages,
  localMessages,
}: {
  inheritedMessages: TreeMessage[]
  localMessages: TreeMessage[]
}): BranchConversationSegments => {
  const branchEventEntry =
    localMessages
      .map((message) => ({
        message,
        metadata: getBranchEventMetadata(message),
      }))
      .find((entry) => entry.metadata !== null) ?? null

  const branchEventMessage = branchEventEntry?.message ?? null
  const branchEventMetadata = branchEventEntry?.metadata ?? null
  const branchSummaryLabel =
    branchEventMessage ? getBranchSummaryLabelForMessage(branchEventMessage) : null

  return {
    inheritedMessages,
    branchEventMessage,
    childMessages: branchEventMessage
      ? localMessages.filter((message) => message.id !== branchEventMessage.id)
      : localMessages,
    branchEventMetadata,
    branchSummaryLabel,
  }
}
