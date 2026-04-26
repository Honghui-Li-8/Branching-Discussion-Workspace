import { useState, type RefObject } from 'react'
import type { BranchFollowupBootstrap } from '../discussion-tree/hooks/useDiscussionTreeUiState'
import type { TreeMessage } from '../../types/tree'
import { UserConversationMessage } from './UserConversationMessage'
import { AssistantConversationMessage } from './AssistantConversationMessage'
import { getBranchSummaryLabelForMessage } from './branchConversationView'
import { MergeProposalCard } from '../merge/MergeProposalCard'

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
}: MessageRowProps) => {
  const branchSummaryLabel = getBranchSummaryLabelForMessage(message)
  if (branchSummaryLabel) {
    return <BranchEventRow key={message.id} label={branchSummaryLabel} />
  }

  if (message.metadata?.eventType === 'merge_proposal') {
    return (
      <MergeProposalCard
        key={message.id}
        message={message}
        nodeId={nodeId}
        onNodeIsMerged={onNodeIsMerged}
      />
    )
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
    <div className="h-px flex-1 bg-[#c6ddea]" />
    <p className="m-0 max-w-[70%] text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4d7186]">
      {label ? `Branch from ${label}` : 'Branch point'}
    </p>
    <div className="h-px flex-1 bg-[#c6ddea]" />
  </div>
)

const BranchEventRow = ({ label }: { label: string | null }) => (
  <div className="flex justify-center">
    <div className="max-w-[88%] rounded-full border border-[#d8e7f0] bg-[#f4f9fc] px-4 py-2 text-center text-[12px] text-[#55798e] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
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
        <section className="mb-3 rounded-[18px] border border-[#d8e8f2] bg-white/55 p-3 text-[#45697e]">
          <div className="rounded-lg border border-[#f1cabd] bg-[#fff6f3] p-3 text-sm text-[#8a3f2b]">
            Failed to load inherited history: {errorMessage}
          </div>
        </section>
      )
    }

    return null
  }

  return (
    <section className="mb-3 rounded-[18px] border border-[#d8e8f2] bg-white/55 p-3 text-[#45697e]">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-transparent bg-transparent px-1 py-0 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[#53798f] hover:border-[#d8e8f2] hover:bg-white/60"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <span>Inherited history</span>
        <span>{isExpanded ? 'Hide' : 'Show'}</span>
      </button>

      {isExpanded ? (
        <div className="mt-3 flex flex-col gap-2 opacity-75">
          {errorMessage ? (
            <div className="rounded-lg border border-[#f1cabd] bg-[#fff6f3] p-3 text-sm text-[#8a3f2b] opacity-100">
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
  conversationScrollRef,
  bottomAnchorRef,
}: ConversationMessageListProps) => {
  return (
    <div
      ref={conversationScrollRef}
      className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fdfefe_0%,#f8fdff_100%)] px-4 py-3"
      style={{ minHeight: 0 }}
    >
      <div className="flex min-h-full flex-col justify-end gap-2">
        {isLoading ? (
          <p className="m-0 self-stretch rounded-lg border border-dashed border-[#bdd7eb] bg-white p-3 text-sm text-[#40657d]">
            Loading messages...
          </p>
        ) : errorMessage ? (
          <p className="m-0 self-stretch rounded-lg border border-[#f1cabd] bg-[#fff6f3] p-3 text-sm text-[#8a3f2b]">
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
              }),
            )}
          </>
        ) : (
          <p className="m-0 self-stretch rounded-lg border border-dashed border-[#bdd7eb] bg-white p-3 text-sm text-[#40657d]">
            No messages yet for this node. Start with your first thought below.
          </p>
        )}
        <div ref={bottomAnchorRef} className="h-px w-full shrink-0" aria-hidden="true" />
      </div>
    </div>
  )
}
