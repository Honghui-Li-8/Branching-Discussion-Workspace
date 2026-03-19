import type { RefObject } from 'react'
import type { TreeMessage } from '../../types/tree'

type ConversationMessageListProps = {
  messages: TreeMessage[]
  conversationScrollRef: RefObject<HTMLDivElement | null>
}

export const ConversationMessageList = ({
  messages,
  conversationScrollRef,
}: ConversationMessageListProps) => {
  return (
    <div
      ref={conversationScrollRef}
      className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fdfefe_0%,#f8fdff_100%)] px-4 py-3"
      style={{ minHeight: 0 }}
    >
      <div className="flex min-h-full flex-col justify-end gap-2">
        {messages.length ? (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-[14px] px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-[#e8f4fd] text-[#12384c]'
                    : 'border border-[#b5deef] bg-white text-[#1f4f68]'
                }`}
                style={{ overflowWrap: 'anywhere' }}
              >
                {message.content}
              </div>
            </div>
          ))
        ) : (
          <p className="m-0 self-stretch rounded-lg border border-dashed border-[#bdd7eb] bg-white p-3 text-sm text-[#40657d]">
            No messages yet for this node. Start with your first thought below.
          </p>
        )}
      </div>
    </div>
  )
}
