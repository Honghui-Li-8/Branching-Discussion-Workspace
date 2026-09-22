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
      className={`relative flex min-h-96 flex-1 flex-col overflow-hidden border bg-bg-default transition-all duration-300 ease-in-out motion-reduce:transition-none lg:min-h-0 ${isSidebarCollapsed ? 'rounded-none border-transparent' : 'rounded-lg border-border-default shadow-panel'}`}
      aria-label="Discussion tree view"
    >
      <header
        className="relative border-b border-border-default bg-bg-default/95 px-5 py-3 backdrop-blur"
        style={{ zIndex: zIndex.discussionHeader }}
      >
        <h1 className="m-0 text-heading font-medium text-text-default">{workspaceTitle}</h1>
      </header>

      {children}
    </section>
  )
}
