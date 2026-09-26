import { DiscussionTreeView } from './DiscussionTreeView'
import { AppSidebar } from './AppSidebar'

/**
 * The signed-in shell (A10): navigation landmark beside one main landmark.
 * The main region is a flex column of fixed height so the workspace region
 * inside it can fill it with `flex-1 min-h-0` instead of a viewport pin.
 * Edge to edge, as in A03 frame 302:445: the sidebar's own border is the only
 * divider, with no padding around the workspace region.
 */
export const WorkspaceLayout = () => {
  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-bg-subtlest text-text-default lg:grid-cols-[auto_minmax(0,1fr)]">
      <AppSidebar />

      <main id="main" aria-label="Workspace" className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
        <DiscussionTreeView />
      </main>
    </div>
  )
}
