import type { ReactNode } from 'react'

type DiscussionTreeShellProps = {
  workspaceTitle: string
  children: ReactNode
}

/**
 * Layout shell for the discussion tree view: the canvas and the conversation
 * panel run edge to edge with no card, border or title bar (A03 frame 302:445,
 * owner decision 2026-09-25). The workspace name stays the page's level-one
 * heading for assistive tech; sighted users read it from the selected row in
 * the sidebar.
 */
export const DiscussionTreeShell = ({ workspaceTitle, children }: DiscussionTreeShellProps) => {
  return (
    <section
      className="relative flex min-h-96 flex-1 flex-col overflow-hidden bg-bg-default lg:min-h-0"
      aria-label="Discussion tree view"
    >
      <h1 className="sr-only">{workspaceTitle}</h1>
      {children}
    </section>
  )
}
