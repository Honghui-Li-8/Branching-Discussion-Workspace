import { DiscussionTreeView } from './DiscussionTreeView'
import { AppSidebar } from './AppSidebar'
import { useAppSelector } from '../store/hooks'
import { selectSidebarCollapsed } from '../store/slices/appShellSlice'

// A06: moved out of App.tsx unchanged (pure file move). The signed-in shell's
// restyle belongs to A10; nothing here may change under A06.
export const WorkspaceLayout = () => {
  const isSidebarCollapsed = useAppSelector(selectSidebarCollapsed)

  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-[#f5f7fb] text-slate-900 lg:grid-cols-[auto_minmax(0,1fr)]">
      <AppSidebar />

      <main className={`min-h-0 min-w-0 overflow-y-auto transition-[padding] duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:p-0' : 'p-3 lg:p-4'}`}>
        <DiscussionTreeView />
      </main>
    </div>
  )
}
