import type { ReactNode } from 'react'
import { zIndex } from '../../../theme/zIndex'
import { useAppSelector } from '../../../store/hooks'
import { selectSidebarCollapsed } from '../../../store/slices/appShellSlice'

type DiscussionTreeShellProps = {
  workspaceTitle: string
  children: ReactNode
}

/**
 * Layout shell for the discussion tree view.
 * Renders the workspace header chrome and wraps the canvas area.
 */
export const DiscussionTreeShell = ({ workspaceTitle, children }: DiscussionTreeShellProps) => {
  const isSidebarCollapsed = useAppSelector(selectSidebarCollapsed)

  return (
    <section
      className={`relative flex h-auto min-h-[430px] flex-col overflow-hidden border bg-[linear-gradient(180deg,#f5fbff_0%,#f8fdff_100%)] transition-all duration-300 ease-in-out lg:min-h-0 ${isSidebarCollapsed ? 'rounded-none border-transparent lg:h-screen' : 'rounded-3xl border-[#a8d1e5] lg:h-[calc(100vh-40px)]'}`}
      aria-label="Discussion tree view"
    >
      <header
        className="relative border-b border-[#c3e0ef] bg-[linear-gradient(90deg,#ebf7ff_0%,#f8fdff_100%)] px-5 py-2"
        style={{ zIndex: zIndex.discussionHeader }}
      >
        <h1 className="m-0 text-[18px] font-medium leading-snug text-[#12384c]">{workspaceTitle}</h1>
      </header>

      {children}
    </section>
  )
}
