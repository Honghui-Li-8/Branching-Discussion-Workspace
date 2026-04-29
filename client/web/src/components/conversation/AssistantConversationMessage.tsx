import { useEffect } from 'react'
import type { TreeMessage } from '../../types/tree'
import type { BranchFollowupBootstrap } from '../discussion-tree/hooks/useDiscussionTreeUiState'
import {
  formatCitationLabel,
  getRenderableCitations,
} from './citationMetadata'
import { AssistantMessageAnnotationWrapper } from './AssistantMessageAnnotations'
import { ModelMarkdown } from './ModelMarkdown'
import { DEBUG_RAW_MARKDOWN } from '../../devFlags'

type AssistantConversationMessageProps = {
  message: TreeMessage
  conversationModel: string
  readOnly?: boolean
  onBranchFollowupCreated?: (
    nodeId: string,
    branchFollowupBootstrap: BranchFollowupBootstrap,
  ) => void
}

export const AssistantConversationMessage = ({
  message,
  conversationModel,
  readOnly = false,
  onBranchFollowupCreated,
}: AssistantConversationMessageProps) => {
  const citations = getRenderableCitations(message)

  useEffect(() => {
    if (!DEBUG_RAW_MARKDOWN) {
      return
    }

    console.log('[assistant-message] raw markdown branch active', {
      messageId: message.id,
      content: message.content,
    })
  }, [message.content, message.id])

  return (
    <div className="mb-5 flex justify-start">
      <div className="min-w-0 w-full">
        <div
          className="w-full rounded-2xl border border-[#9fc4d8]/85 bg-white/55 px-5 py-4 text-sm leading-relaxed text-[#1f4f68] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[2px]"
          style={{ overflowWrap: 'anywhere' }}
        >
          {DEBUG_RAW_MARKDOWN ? (
            <div data-debug-raw-markdown="true">
              <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a5a00]">
                Raw markdown debug
              </div>
              <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs text-[#1f4f68]">
                {message.content}
              </pre>
            </div>
          ) : (
            <AssistantMessageAnnotationWrapper
              messageId={message.id}
              conversationModel={conversationModel}
              readOnly={readOnly}
              onBranchFollowupCreated={onBranchFollowupCreated}
            >
              <ModelMarkdown content={message.content} />
            </AssistantMessageAnnotationWrapper>
          )}
        </div>

        {citations.length > 0 ? (
          <div className="mt-2 mr-4 flex flex-col gap-1">
            {citations.map((citation, index) => (
              <div
                key={`${message.id}-${citation.messageId}-${citation.chunkIndex ?? index}`}
                className="rounded-xl border border-[#d7eaf5] bg-[#f7fbfe] px-2.5 py-2"
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
