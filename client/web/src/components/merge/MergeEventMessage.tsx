import { parseMergeEventMetadata } from '@branching/shared'
import type { TreeMessage } from '../../types/tree'

type MergeEventMessageProps = {
  message: TreeMessage
}

export const MergeEventMessage = ({ message }: MergeEventMessageProps) => {
  const metadata = parseMergeEventMetadata(message.metadata)

  if (!metadata) {
    return null
  }

  return (
    <div className="rounded-[14px] border border-[#b8d9c8] bg-[#f0f9f4] px-4 py-3">
      <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3a7a5a]">
        ↩ Merged from: {metadata.sourceBranchTitle}
      </p>
      <p className="m-0 text-sm leading-relaxed text-[#12384c]">{metadata.conclusion}</p>
    </div>
  )
}
