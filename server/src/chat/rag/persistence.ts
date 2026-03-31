import type {
  Citation,
  ContextSnapshot,
  ConversationTurnMetadata,
  MessageMetadata,
  RetrieverDiagnostics,
} from '@branching/shared'

export const buildAssistantMessageMetadata = ({
  existing = {},
  citations,
}: {
  existing?: MessageMetadata
  citations: Citation[]
}): MessageMetadata => {
  if (citations.length === 0) {
    return existing
  }

  return {
    ...existing,
    citations,
  }
}

export const buildConversationTurnMetadata = ({
  existing = {},
  snapshot,
  diagnostics,
}: {
  existing?: ConversationTurnMetadata
  snapshot?: ContextSnapshot
  diagnostics?: RetrieverDiagnostics
}): ConversationTurnMetadata => ({
  ...existing,
  ...(snapshot
    ? {
        contextSnapshotId: snapshot.id,
        contextSnapshot: snapshot,
      }
    : {}),
  ...(diagnostics ? { retrievalDiagnostics: diagnostics } : {}),
})
