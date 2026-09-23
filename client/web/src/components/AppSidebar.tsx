import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { WorkspaceItemActions } from './WorkspaceItemActions'
import { CreateWorkspacePopover } from './CreateWorkspacePopover'
import { BrandMark } from './BrandMark'
import {
  selectActiveWorkspaceId,
  selectSidebarCollapsed,
  selectWorkspaces,
  selectWorkspacesLoading,
  setActiveWorkspaceId,
  setSidebarCollapsed,
} from '../store/slices/appShellSlice'
import { useAuth } from './useAuth'
import { trpc } from '../trpc'
import { CreditBalanceIndicator } from './CreditBalanceIndicator'
import { AccountMenu } from './AccountMenu'
import { Button } from './ui/button'
import { Input } from './ui/form-field'
import { Skeleton } from './ui/skeleton'
import { PANEL_TOGGLE_ICONS } from '../lib/icons'
import { cn } from '../lib/utils'

/**
 * The signed-in navigation frame (A10): identity, the workspace list with a
 * visible per-row menu, and the account row. Behaviour is the pre-A10 sidebar's;
 * only the markup moved onto the A05 roles and the ui primitives.
 */
export const AppSidebar = () => {
  const dispatch = useAppDispatch()
  const workspaces = useAppSelector(selectWorkspaces)
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId)
  const isWorkspacesLoading = useAppSelector(selectWorkspacesLoading)
  const utils = trpc.useUtils()
  const { isAuthBootstrapPending, authError } = useAuth()

  const invalidateWorkspaceList = async () => {
    await utils.workspacesList.invalidate()
  }

  const updateWorkspaceMutation = trpc.workspaceUpdate.useMutation({
    onSuccess: async () => {
      await invalidateWorkspaceList()
    },
  })

  const deleteWorkspaceMutation = trpc.workspaceDelete.useMutation({
    onSuccess: async () => {
      await invalidateWorkspaceList()
    },
  })

  const isCollapsed = useAppSelector(selectSidebarCollapsed)
  const setIsCollapsed = (val: boolean) => dispatch(setSidebarCollapsed(val))

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const startRename = (id: string, title: string) => {
    setRenamingId(id)
    setRenameValue(title)
  }

  const saveRename = () => {
    if (renamingId && renameValue.trim()) {
      updateWorkspaceMutation.mutate({ id: renamingId, title: renameValue.trim() })
    }
    setRenamingId(null)
  }

  const handleDelete = (workspaceId: string) => {
    deleteWorkspaceMutation.mutate({ id: workspaceId })
  }

  const workspaceActionError =
    updateWorkspaceMutation.error?.message ??
    deleteWorkspaceMutation.error?.message ??
    null
  const ExpandIcon = PANEL_TOGGLE_ICONS.left.open
  const CollapseIcon = PANEL_TOGGLE_ICONS.left.close

  return (
    <>
      <aside
        aria-label="Workspace navigation"
        className={cn(
          'flex min-h-0 flex-col border-b border-border-default bg-bg-default transition-[width] duration-300 ease-in-out motion-reduce:transition-none lg:min-h-screen lg:border-r lg:border-b-0',
          isCollapsed ? 'lg:w-12 lg:overflow-hidden' : 'lg:w-72',
        )}
      >
        {/* Collapsed strip — desktop only. Rendered only while collapsed so the
            expand control is the one recovery path and is observable as such. */}
        {isCollapsed ? (
          <div className="hidden flex-1 flex-col items-center justify-between py-3 lg:flex">
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => setIsCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ExpandIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
            <AccountMenu variant="avatar" />
          </div>
        ) : null}

        <div className={cn('flex min-h-0 flex-1 flex-col', isCollapsed && 'lg:hidden')}>
          <div className="flex items-center justify-between gap-2 border-b border-border-default px-4 py-3">
            <BrandMark tone="light" />
            <Button
              variant="ghost"
              size="sm"
              className="hidden px-2 lg:inline-flex"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <CollapseIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <nav aria-label="Workspaces" className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
              <h2 className="m-0 text-caption font-medium uppercase tracking-wide text-text-muted">
                Workspaces
              </h2>
              <CreateWorkspacePopover />
            </div>

            <ul className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-y-auto px-2 pb-2 lg:max-h-none">
              {isWorkspacesLoading && workspaces.length === 0 ? (
                <li className="flex flex-col gap-1 px-1 py-1">
                  <span role="status" className="sr-only">
                    Loading workspaces
                  </span>
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </li>
              ) : workspaces.length === 0 ? (
                <li className="rounded-md border border-dashed border-border-default px-3 py-2.5 text-caption text-text-muted">
                  No workspaces yet.
                </li>
              ) : (
                workspaces.map((workspace) => {
                  const isActive = workspace.id === activeWorkspaceId
                  const workspaceSummary = workspace.summary?.trim() || 'No summary yet.'
                  const isRenaming = renamingId === workspace.id

                  return (
                    <li key={workspace.id}>
                      {isRenaming ? (
                        <Input
                          autoFocus
                          aria-label="Workspace name"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={saveRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="text-label font-medium"
                        />
                      ) : (
                        <WorkspaceItemActions
                          workspaceTitle={workspace.title}
                          onRename={() => startRename(workspace.id, workspace.title)}
                          onDelete={() => handleDelete(workspace.id)}
                          isDeletePending={deleteWorkspaceMutation.isPending}
                        >
                          <button
                            type="button"
                            aria-current={isActive ? 'true' : undefined}
                            className={cn(
                              'flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 rounded-md border-l-2 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2',
                              isActive
                                ? 'border-accent-default bg-accent-tint'
                                : 'border-transparent hover:bg-bg-subtle',
                            )}
                            onClick={() => dispatch(setActiveWorkspaceId(workspace.id))}
                          >
                            <span className="truncate text-label font-medium text-text-default">
                              {workspace.title}
                            </span>
                            <span className="line-clamp-2 text-caption text-text-muted">
                              {workspaceSummary}
                            </span>
                          </button>
                        </WorkspaceItemActions>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
          </nav>

          <div className="border-t border-border-default px-3 py-3">
            <AccountMenu variant="row" />
            <div className="px-1.5">
              <CreditBalanceIndicator />
            </div>
            {authError && !isAuthBootstrapPending ? (
              <p role="alert" className="mt-2 mb-0 px-1.5 text-caption text-error-default">
                {authError}
              </p>
            ) : workspaceActionError ? (
              <p role="alert" className="mt-2 mb-0 px-1.5 text-caption text-error-default">
                {workspaceActionError}
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  )
}
