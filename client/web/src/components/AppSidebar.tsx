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
import { AppTooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/disclosure'
import { WorkspaceOutline } from './WorkspaceOutline'
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

  const [sidebarTab, setSidebarTab] = useState<'workspaces' | 'outline'>('workspaces')
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

          {/* A03 sidebar anatomy (Figma 302:447, owner review 2026-09-22): the
              create action is a full-width primary button above a small-caps
              label; rows are single-line titles, the current one on a light
              accent tint with no bar. The summary is a tooltip, not a second line. */}
          <nav aria-label="Workspaces" className="flex min-h-0 flex-1 flex-col">
            <div className="px-3 pt-3">
              <CreateWorkspacePopover />
            </div>

            {/* A10b: Workspaces | Outline segmented control (A03 frame 302:682). */}
            <Tabs
              value={sidebarTab}
              onValueChange={(value) => setSidebarTab(value === 'outline' ? 'outline' : 'workspaces')}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList
                aria-label="Sidebar view"
                className="mx-3 mt-3 grid grid-cols-2 gap-0 rounded-md border border-border-default bg-bg-subtle p-0.5"
              >
                <TabsTrigger
                  value="workspaces"
                  className="rounded-sm border-b-0 py-1.5 text-center data-[state=active]:bg-accent-tint data-[state=active]:text-accent-strong"
                >
                  Workspaces
                </TabsTrigger>
                <TabsTrigger
                  value="outline"
                  disabled={!activeWorkspaceId}
                  className="rounded-sm border-b-0 py-1.5 text-center data-[state=active]:bg-accent-tint data-[state=active]:text-accent-strong"
                >
                  Outline
                </TabsTrigger>
              </TabsList>

              <TabsContent value="workspaces" className="flex min-h-0 flex-1 flex-col pt-2 text-text-default">
            <AppTooltipProvider>
            <ul className="m-0 flex max-h-56 list-none flex-col gap-0.5 overflow-y-auto px-2 pb-2 lg:max-h-none">
              {isWorkspacesLoading && workspaces.length === 0 ? (
                <li className="flex flex-col gap-1 px-1 py-1">
                  <span role="status" className="sr-only">
                    Loading workspaces
                  </span>
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-current={isActive ? 'true' : undefined}
                                className={cn(
                                  'flex h-9 min-w-0 flex-1 cursor-pointer items-center rounded-md px-3 text-left text-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2',
                                  isActive
                                    ? 'bg-accent-tint font-medium text-accent-strong'
                                    : 'text-text-default hover:bg-bg-subtle',
                                )}
                                onClick={() => dispatch(setActiveWorkspaceId(workspace.id))}
                              >
                                <span className="truncate">{workspace.title}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-narrow">
                              {workspaceSummary}
                            </TooltipContent>
                          </Tooltip>
                        </WorkspaceItemActions>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
            </AppTooltipProvider>
              </TabsContent>
              <TabsContent value="outline" className="min-h-0 flex-1 overflow-y-auto pt-2 text-text-default">
                <WorkspaceOutline />
              </TabsContent>
            </Tabs>
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
