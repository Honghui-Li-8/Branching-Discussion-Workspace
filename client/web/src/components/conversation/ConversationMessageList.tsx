import type { RefObject } from 'react'
import type { TreeMessage } from '../../types/tree'
import { UserConversationMessage } from './UserConversationMessage'
import { AssistantConversationMessage } from './AssistantConversationMessage'

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
        ) : messages.length ? (
          messages.map((message) => {
            const isPending = pendingMessageIds.has(message.id)
            const isFailed = failedMessageIds.has(message.id)
            const isUser = message.role === 'user'

            if (isUser) {
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
              />
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
