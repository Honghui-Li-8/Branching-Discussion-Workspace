import { DiscussionTreeView } from './components/DiscussionTreeView'
import { AppSidebar } from './components/AppSidebar'

const App = () => {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <AppSidebar />

      <main className="min-h-0 min-w-0 p-3.5 lg:min-h-screen lg:p-5">
        <DiscussionTreeView />
      </main>
    </div>
  )
}

export default App
