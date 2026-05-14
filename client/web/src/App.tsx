import { Navigate, Route, Routes } from 'react-router-dom'
import { DiscussionTreeView } from './components/DiscussionTreeView'
import { AppSidebar } from './components/AppSidebar'
import { AuthCallback } from './components/AuthCallback'
import { LoginPage } from './components/LoginPage'
import { useAppSelector } from './store/hooks'
import { selectAuthStatus } from './store/slices/authSlice'
import { selectSidebarCollapsed } from './store/slices/appShellSlice'

const WorkspaceLayout = () => {
  const isSidebarCollapsed = useAppSelector(selectSidebarCollapsed)

  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] lg:grid-cols-[auto_minmax(0,1fr)]">
      <AppSidebar />

      <main className={`min-h-0 min-w-0 overflow-y-auto transition-[padding] duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:p-0' : 'p-3.5 lg:p-5'}`}>
        <DiscussionTreeView />
      </main>
    </div>
  )
}

const AuthBootstrapScreen = () => {
  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] px-4 text-sm text-[#456579]">
      Checking sign-in...
    </main>
  )
}

const WorkspaceOrLogin = () => {
  const authStatus = useAppSelector(selectAuthStatus)

  if (authStatus === 'unknown') {
    return <AuthBootstrapScreen />
  }

  if (authStatus === 'unauthenticated') {
    return <LoginPage />
  }

  return <WorkspaceLayout />
}

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<WorkspaceOrLogin />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
