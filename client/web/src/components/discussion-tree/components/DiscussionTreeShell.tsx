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
      className={`relative flex h-auto min-h-[430px] flex-col overflow-hidden border bg-white transition-all duration-300 ease-in-out lg:min-h-0 ${isSidebarCollapsed ? 'rounded-none border-transparent lg:h-screen' : 'rounded-xl border-slate-200 shadow-[0_18px_50px_rgba(15,23,42,0.08)] lg:h-[calc(100vh-32px)]'}`}
      aria-label="Discussion tree view"
    >
      <header
        className="relative border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur"
        style={{ zIndex: zIndex.discussionHeader }}
      >
        <h1 className="m-0 text-[20px] font-semibold leading-snug text-slate-950">{workspaceTitle}</h1>
      </header>

      {children}
    </section>
  )
}
