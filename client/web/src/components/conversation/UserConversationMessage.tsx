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
          className={`rounded-xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
            isFailed
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'bg-slate-950 text-white'
          }`}
          style={{ overflowWrap: 'anywhere' }}
        >
          <p className="m-0 whitespace-pre-wrap">{message.content}</p>
        </div>

        {isPending ? (
          <p className="mt-1 mb-0 text-[11px] text-slate-500">Sending...</p>
        ) : null}

        {isFailed ? (
          <div className="mt-1 flex items-center justify-end gap-2">
            <p className="m-0 text-[11px] text-red-700">Not sent</p>
            <button
              type="button"
              className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] text-red-700 transition-colors duration-150 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              onClick={() => onRetryFailedMessage(message.id)}
            >
              Retry
            </button>
            <button
              type="button"
              className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] text-red-700 transition-colors duration-150 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
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
