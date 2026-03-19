import { useMemo, useState } from 'react'
import { DiscussionTreeView } from './components/DiscussionTreeView'
import { IntroScreen } from './components/IntroScreen'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { initialWorkspaces } from './data/mockWorkspaces'
import type { Workspace } from './types/workspace'

const App = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  )

  const handleCreateWorkspace = () => {
    const nextNumber = workspaces.length + 1
    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      title: `New Workspace ${nextNumber}`,
      summary: 'New decision workspace',
    }

    setWorkspaces((current) => [newWorkspace, ...current])
    setActiveWorkspaceId(newWorkspace.id)
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <WorkspaceSidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={setActiveWorkspaceId}
        onCreateWorkspace={handleCreateWorkspace}
      />

      <main className="min-h-0 min-w-0 p-3.5 lg:min-h-screen lg:p-5">
        {activeWorkspace ? (
          <DiscussionTreeView workspaceTitle={activeWorkspace.title} />
        ) : (
          <IntroScreen />
        )}
      </main>
    </div>
  )
}

export default App
