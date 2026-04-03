import type { TreeMessage } from '../../types/tree'
import {
  formatCitationLabel,
  getRenderableCitations,
} from './citationMetadata'
import { ModelMarkdown } from './ModelMarkdown'

type AssistantConversationMessageProps = {
  message: TreeMessage
}

export const AssistantConversationMessage = ({
  message,
}: AssistantConversationMessageProps) => {
  const citations = getRenderableCitations(message)

  return (
    <div className="flex justify-start">
      <div className="w-full">
        <div
          className="w-full rounded-[14px] border border-[#9fc4d8]/85 bg-white/55 px-3 py-2 text-sm leading-relaxed text-[#1f4f68] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[2px]"
          style={{ overflowWrap: 'anywhere' }}
        >
          <ModelMarkdown content={message.content} />
        </div>

        {citations.length > 0 ? (
          <div className="mt-2 mr-4 flex flex-col gap-1">
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
      </div>
    </div>
  )
}
