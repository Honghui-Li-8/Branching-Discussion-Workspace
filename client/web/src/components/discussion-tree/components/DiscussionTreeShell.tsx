import type { ReactNode } from 'react'
import { zIndex } from '../../../theme/zIndex'

type DiscussionTreeShellProps = {
  workspaceTitle: string
  children: ReactNode
}

/**
 * Layout shell for the discussion tree view.
 * Renders the workspace header chrome and wraps the canvas area.
 */
export const DiscussionTreeShell = ({ workspaceTitle, children }: DiscussionTreeShellProps) => {
  return (
    <section
      className="relative flex h-auto min-h-[430px] flex-col overflow-hidden rounded-3xl border border-[#a8d1e5] bg-[linear-gradient(180deg,#f5fbff_0%,#f8fdff_100%)] lg:h-[calc(100vh-40px)] lg:min-h-0"
      aria-label="Discussion tree view"
    >
      <header
        className="relative border-b border-[#c3e0ef] bg-[linear-gradient(90deg,#ebf7ff_0%,#f8fdff_100%)] px-5 py-4"
        style={{ zIndex: zIndex.discussionHeader }}
      >
        <p className="m-0 text-[11px] uppercase tracking-[0.11em] text-[#40718a]">Workspace</p>
        <h1 className="mb-0 mt-1 text-[26px] leading-[1.2] text-[#12384c]">{workspaceTitle}</h1>
      </header>

      {children}
    </section>
  )
}
