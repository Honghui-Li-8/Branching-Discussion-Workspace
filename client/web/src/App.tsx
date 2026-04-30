import { DiscussionTreeView } from './components/DiscussionTreeView'
import { AppSidebar } from './components/AppSidebar'
import { useAppSelector } from './store/hooks'
import { selectSidebarCollapsed } from './store/slices/appShellSlice'

const App = () => {
  const isSidebarCollapsed = useAppSelector(selectSidebarCollapsed)

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] lg:grid-cols-[auto_minmax(0,1fr)]">
      <AppSidebar />

      <main className={`min-h-0 min-w-0 transition-[padding] duration-300 ease-in-out lg:min-h-screen ${isSidebarCollapsed ? 'lg:p-0' : 'lg:p-5'}`}>
        <DiscussionTreeView />
      </main>
    </div>
  )
}

export default App
