import { DiscussionTreeView } from './components/DiscussionTreeView'
import { IntroScreen } from './components/IntroScreen'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { useAppDispatch, useAppSelector } from './store/hooks'
import {
  createWorkspace,
  selectActiveWorkspace,
  selectActiveWorkspaceId,
  selectWorkspaces,
  setActiveWorkspaceId,
} from './store/slices/appShellSlice'
import { selectAuthUser } from './store/slices/authSlice'

const App = () => {
  const dispatch = useAppDispatch()
  const workspaces = useAppSelector(selectWorkspaces)
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId)
  const activeWorkspace = useAppSelector(selectActiveWorkspace)
  const authUser = useAppSelector(selectAuthUser)

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <WorkspaceSidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        currentUserName={authUser?.displayName ?? 'User'}
        onSelectWorkspace={(workspaceId) => dispatch(setActiveWorkspaceId(workspaceId))}
        onCreateWorkspace={() => dispatch(createWorkspace())}
      />

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
