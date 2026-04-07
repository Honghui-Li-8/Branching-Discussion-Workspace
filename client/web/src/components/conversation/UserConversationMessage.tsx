import type { TreeMessage } from '../../types/tree'

type UserConversationMessageProps = {
  message: TreeMessage
  isPending: boolean
  isFailed: boolean
  onRetryFailedMessage: (messageId: string) => void
  onDismissFailedMessage: (messageId: string) => void
}

export const UserConversationMessage = ({
  message,
  isPending,
  isFailed,
  onRetryFailedMessage,
  onDismissFailedMessage,
}: UserConversationMessageProps) => {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%]">
        <div
          className={`rounded-[14px] px-3 py-2 text-sm leading-relaxed ${
            isFailed
              ? 'border border-[#f1cabd] bg-[#fff6f3] text-[#8a3f2b]'
              : 'bg-[#e8f4fd] text-[#12384c]'
          }`}
          style={{ overflowWrap: 'anywhere' }}
        >
          <p className="m-0 whitespace-pre-wrap">{message.content}</p>
        </div>

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
}
