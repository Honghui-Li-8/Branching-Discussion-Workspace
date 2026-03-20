import { DiscussionTreeView } from './components/DiscussionTreeView'
import { IntroScreen } from './components/IntroScreen'
import { AppSidebar } from './components/AppSidebar'
import { useAppSelector } from './store/hooks'
import { selectActiveWorkspace } from './store/slices/appShellSlice'

const App = () => {
  const activeWorkspace = useAppSelector(selectActiveWorkspace)

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <AppSidebar />

      <main className="min-h-0 min-w-0 p-3.5 lg:min-h-screen lg:p-5">
        {activeWorkspace ? (
          <DiscussionTreeView key={activeWorkspace.id} workspaceTitle={activeWorkspace.title} />
        ) : (
          <IntroScreen />
        )}
      </main>
    </div>
  )
}

export default App
