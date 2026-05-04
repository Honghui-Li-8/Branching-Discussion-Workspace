import { Navigate, Route, Routes } from 'react-router-dom'
import { DiscussionTreeView } from './components/DiscussionTreeView'
import { AppSidebar } from './components/AppSidebar'

const WorkspaceLayout = () => {
  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <AppSidebar />

      <main className="min-h-0 min-w-0 overflow-y-auto p-3.5 lg:p-5">
        <DiscussionTreeView />
      </main>
    </div>
  )
}

const AuthCallbackPlaceholder = () => {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f3fbff] px-4 text-sm text-[#456579]">
      Completing sign-in...
    </div>
  )
}

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<WorkspaceLayout />} />
      <Route path="/auth/callback" element={<AuthCallbackPlaceholder />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
