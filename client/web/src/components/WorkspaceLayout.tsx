import { DiscussionTreeView } from './DiscussionTreeView'
import { AppSidebar } from './AppSidebar'
import { useAppSelector } from '../store/hooks'
import { selectSidebarCollapsed } from '../store/slices/appShellSlice'
import { cn } from '../lib/utils'

/**
 * The signed-in shell (A10): navigation landmark beside one main landmark.
 * The main region is a flex column of fixed height so the workspace region
 * inside it can fill it with `flex-1 min-h-0` instead of a viewport pin.
 */
export const WorkspaceLayout = () => {
  const isSidebarCollapsed = useAppSelector(selectSidebarCollapsed)

  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-bg-subtlest text-text-default lg:grid-cols-[auto_minmax(0,1fr)]">
      <AppSidebar />

      <main
        id="main"
        aria-label="Workspace"
        className={cn(
          'flex min-h-0 min-w-0 flex-col overflow-y-auto transition-[padding] duration-300 ease-in-out motion-reduce:transition-none',
          isSidebarCollapsed ? 'lg:p-0' : 'p-3 lg:p-4',
        )}
      >
        <DiscussionTreeView />
      </main>
    </div>
  )
}
