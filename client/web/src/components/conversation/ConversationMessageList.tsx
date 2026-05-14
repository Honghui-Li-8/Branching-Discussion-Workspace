import { useState, type RefObject } from 'react'
import { STRUCTURAL_MESSAGE_TYPES } from '@branching/shared'
import type { BranchFollowupBootstrap } from '../discussion-tree/hooks/useDiscussionTreeUiState'
import type { TreeMessage } from '../../types/tree'
import { UserConversationMessage } from './UserConversationMessage'
import { AssistantConversationMessage } from './AssistantConversationMessage'
import { getBranchSummaryLabelForMessage } from './branchConversationView'
import { MergeProposalCard } from '../merge/MergeProposalCard'
import { MergeEventMessage } from '../merge/MergeEventMessage'

type ConversationMessageListProps = {
  nodeId: string
  messages: TreeMessage[]
  inheritedMessages: TreeMessage[]
  branchEventMessage: TreeMessage | null
  branchSummaryLabel: string | null
  conversationModel: string
  isLoading: boolean
  errorMessage: string | null
  inheritedErrorMessage: string | null
  pendingMessageIds: Set<string>
  failedMessageIds: Set<string>
  onRetryFailedMessage: (messageId: string) => void
  onDismissFailedMessage: (messageId: string) => void
  onBranchFollowupCreated: (
    nodeId: string,
    branchFollowupBootstrap: BranchFollowupBootstrap,
  ) => void
  onNodeIsMerged?: () => void
  onMergeActionPending?: (label: string) => number
  onMergeActionSettled?: (token: number) => void
  conversationScrollRef: RefObject<HTMLDivElement | null>
  bottomAnchorRef: RefObject<HTMLDivElement | null>
}

type MessageRowProps = {
  message: TreeMessage
  nodeId: string
  isPending?: boolean
  isFailed?: boolean
  readOnly?: boolean
  conversationModel: string
  onRetryFailedMessage: (messageId: string) => void
  onDismissFailedMessage: (messageId: string) => void
  onBranchFollowupCreated: (
    nodeId: string,
    branchFollowupBootstrap: BranchFollowupBootstrap,
  ) => void
  onNodeIsMerged?: () => void
  onMergeActionPending?: (label: string) => number
  onMergeActionSettled?: (token: number) => void
}

const renderMessageRow = ({
  message,
  nodeId,
  isPending = false,
  isFailed = false,
  readOnly = false,
  conversationModel,
  onRetryFailedMessage,
  onDismissFailedMessage,
  onBranchFollowupCreated,
  onNodeIsMerged,
  onMergeActionPending,
  onMergeActionSettled,
}: MessageRowProps) => {
  const branchSummaryLabel = getBranchSummaryLabelForMessage(message)
  if (branchSummaryLabel) {
    return <BranchEventRow key={message.id} label={branchSummaryLabel} />
  }

  if (message.metadata?.eventType === STRUCTURAL_MESSAGE_TYPES.mergeProposal) {
    return (
      <MergeProposalCard
        key={message.id}
        message={message}
        nodeId={nodeId}
        onNodeIsMerged={onNodeIsMerged}
        onMergeActionPending={onMergeActionPending}
        onMergeActionSettled={onMergeActionSettled}
      />
    )
  }

  if (message.metadata?.eventType === STRUCTURAL_MESSAGE_TYPES.mergeEvent) {
    return <MergeEventMessage key={message.id} message={message} />
  }

  if (message.role === 'user') {
    return (
      <UserConversationMessage
        key={message.id}
        message={message}
        isPending={isPending}
        isFailed={isFailed}
        onRetryFailedMessage={onRetryFailedMessage}
        onDismissFailedMessage={onDismissFailedMessage}
      />
    )
  }

  return (
    <AssistantConversationMessage
      key={message.id}
      message={message}
      readOnly={readOnly}
      conversationModel={conversationModel}
      onBranchFollowupCreated={onBranchFollowupCreated}
    />
  )
}

const BranchDividerRow = ({ label }: { label: string | null }) => (
  <div className="my-2 flex items-center gap-3 px-1" aria-label="Branch divider">
    <div className="h-px flex-1 bg-slate-200" />
    <p className="m-0 max-w-[70%] text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {label ? `Branch from ${label}` : 'Branch point'}
    </p>
    <div className="h-px flex-1 bg-slate-200" />
  </div>
)

const BranchEventRow = ({ label }: { label: string | null }) => (
  <div className="flex justify-center">
    <div className="max-w-[88%] rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-center text-[12px] text-slate-600">
      {label ? `Branched from: ${label}` : 'Branched from selected context'}
    </div>
  </div>
)

const InheritedHistorySection = ({
  nodeId,
  messages,
  conversationModel,
  errorMessage,
  onRetryFailedMessage,
  onDismissFailedMessage,
  onBranchFollowupCreated,
  onNodeIsMerged,
}: {
  nodeId: string
  messages: TreeMessage[]
  conversationModel: string
  errorMessage: string | null
  onRetryFailedMessage: (messageId: string) => void
  onDismissFailedMessage: (messageId: string) => void
  onBranchFollowupCreated: (
    nodeId: string,
    branchFollowupBootstrap: BranchFollowupBootstrap,
  ) => void
  onNodeIsMerged?: () => void
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  if (messages.length === 0) {
    if (errorMessage) {
      return (
        <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 text-slate-600">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Failed to load inherited history: {errorMessage}
          </div>
        </section>
      )
    }

    return null
  }

  return (
    <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 text-slate-600">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-transparent bg-transparent px-1 py-0 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500 transition-colors duration-150 hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <span>Inherited history</span>
        <span>{isExpanded ? 'Hide' : 'Show'}</span>
      </button>

      {isExpanded ? (
        <div className="mt-3 flex flex-col gap-2 opacity-75">
          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 opacity-100">
              Failed to load inherited history: {errorMessage}
            </div>
          ) : null}

          {messages.map((message) =>
            renderMessageRow({
              message,
              nodeId,
              readOnly: true,
              conversationModel,
              onRetryFailedMessage,
              onDismissFailedMessage,
              onBranchFollowupCreated,
              onNodeIsMerged,
            }),
          )}
        </div>
      ) : null}
    </section>
  )
}

export const ConversationMessageList = ({
  nodeId,
  messages,
  inheritedMessages,
  branchEventMessage,
  branchSummaryLabel,
  conversationModel,
  isLoading,
  errorMessage,
  inheritedErrorMessage,
  pendingMessageIds,
  failedMessageIds,
  onRetryFailedMessage,
  onDismissFailedMessage,
  onBranchFollowupCreated,
  onNodeIsMerged,
  onMergeActionPending,
  onMergeActionSettled,
  conversationScrollRef,
  bottomAnchorRef,
}: ConversationMessageListProps) => {
  return (
    <div
      ref={conversationScrollRef}
      className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-3"
      style={{ minHeight: 0 }}
    >
      <div className="flex min-h-full flex-col justify-end gap-2">
        {isLoading ? (
          <p className="m-0 self-stretch rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
            Loading messages...
          </p>
        ) : errorMessage ? (
          <p className="m-0 self-stretch rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Failed to load messages: {errorMessage}
          </p>
        ) : messages.length || inheritedMessages.length || branchEventMessage ? (
          <>
            <InheritedHistorySection
              nodeId={nodeId}
              messages={inheritedMessages}
              conversationModel={conversationModel}
              errorMessage={inheritedErrorMessage}
              onRetryFailedMessage={onRetryFailedMessage}
              onDismissFailedMessage={onDismissFailedMessage}
              onBranchFollowupCreated={onBranchFollowupCreated}
              onNodeIsMerged={onNodeIsMerged}
            />

            {branchEventMessage || inheritedMessages.length > 0 ? (
              <BranchDividerRow label={branchSummaryLabel} />
            ) : null}

            {branchEventMessage ? <BranchEventRow label={branchSummaryLabel} /> : null}

            {messages.map((message) =>
              renderMessageRow({
                message,
                nodeId,
                isPending: pendingMessageIds.has(message.id),
                isFailed: failedMessageIds.has(message.id),
                conversationModel,
                onRetryFailedMessage,
                onDismissFailedMessage,
                onBranchFollowupCreated,
                onNodeIsMerged,
                onMergeActionPending,
                onMergeActionSettled,
              }),
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="text-3xl opacity-30" aria-hidden="true">✦</span>
            <p className="m-0 text-sm text-slate-500">What would you like to explore?</p>
          </div>
        )}
        <div ref={bottomAnchorRef} className="h-px w-full shrink-0" aria-hidden="true" />
      </div>
    </div>
  )
}
