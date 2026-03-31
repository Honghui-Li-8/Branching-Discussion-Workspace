import type { RefObject } from 'react'
import type { TreeMessage } from '../../types/tree'
import {
  formatCitationLabel,
  getRenderableCitations,
} from './citationMetadata'

type ConversationMessageListProps = {
  messages: TreeMessage[]
  isLoading: boolean
  errorMessage: string | null
  pendingMessageIds: Set<string>
  failedMessageIds: Set<string>
  onRetryFailedMessage: (messageId: string) => void
  onDismissFailedMessage: (messageId: string) => void
  conversationScrollRef: RefObject<HTMLDivElement | null>
}

export const ConversationMessageList = ({
  messages,
  isLoading,
  errorMessage,
  pendingMessageIds,
  failedMessageIds,
  onRetryFailedMessage,
  onDismissFailedMessage,
  conversationScrollRef,
}: ConversationMessageListProps) => {
  return (
    <div
      ref={conversationScrollRef}
      className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fdfefe_0%,#f8fdff_100%)] px-4 py-3"
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
        ) : messages.length ? (
          messages.map((message) => {
            const isPending = pendingMessageIds.has(message.id)
            const isFailed = failedMessageIds.has(message.id)
            const citations = getRenderableCitations(message)

            return (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[82%]">
                  <div
                    className={`rounded-[14px] px-3 py-2 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? isFailed
                          ? 'border border-[#f1cabd] bg-[#fff6f3] text-[#8a3f2b]'
                          : 'bg-[#e8f4fd] text-[#12384c]'
                        : 'border border-[#b5deef] bg-white text-[#1f4f68]'
                    }`}
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    {message.content}
                  </div>

                  {citations.length > 0 ? (
                    <div className="mt-2 flex flex-col gap-1">
                      {citations.map((citation, index) => (
                        <div
                          key={`${message.id}-${citation.messageId}-${citation.chunkIndex ?? index}`}
                          className="rounded-[10px] border border-[#d7eaf5] bg-[#f7fbfe] px-2.5 py-2"
                        >
                          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#487089]">
                            {formatCitationLabel(citation, index)}
                          </p>
                          <p className="mt-1 mb-0 text-[11px] leading-snug text-[#355b73]">
                            {citation.excerpt ?? `Message ${citation.messageId}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isPending ? (
                    <p className="mt-1 mb-0 text-[11px] text-[#3f6a81]">Sending...</p>
                  ) : null}

                  {isFailed ? (
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <p className="m-0 text-[11px] text-[#8a3f2b]">Not sent</p>
                      <button
                        type="button"
                        className="rounded border border-[#e8b8a8] bg-white px-2 py-0.5 text-[11px] text-[#8a3f2b] hover:bg-[#fff3ee]"
                        onClick={() => onRetryFailedMessage(message.id)}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        className="rounded border border-[#e8b8a8] bg-white px-2 py-0.5 text-[11px] text-[#8a3f2b] hover:bg-[#fff3ee]"
                        onClick={() => onDismissFailedMessage(message.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        ) : (
          <p className="m-0 self-stretch rounded-lg border border-dashed border-[#bdd7eb] bg-white p-3 text-sm text-[#40657d]">
            No messages yet for this node. Start with your first thought below.
          </p>
        )}
      </div>
    </div>
  )
}
