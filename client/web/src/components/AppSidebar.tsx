import { useRef, useState } from 'react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { WorkspaceContextMenu } from './WorkspaceContextMenu'
import { CreateWorkspacePopover } from './CreateWorkspacePopover'
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

export const AppSidebar = () => {
  const dispatch = useAppDispatch()
  const workspaces = useAppSelector(selectWorkspaces)
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId)
  const isWorkspacesLoading = useAppSelector(selectWorkspacesLoading)
  const utils = trpc.useUtils()
  const {
    authUser,
    isAuthenticated,
    isAuthBootstrapPending,
    isAuthActionPending,
    authError,
    login,
    logout,
  } = useAuth()

  const invalidateWorkspaceList = async () => {
    await utils.workspacesList.invalidate()
  }

  const createWorkspaceMutation = trpc.workspaceCreate.useMutation({
    onSuccess: async (workspace) => {
      await invalidateWorkspaceList()
      dispatch(setActiveWorkspaceId(workspace.id))
    },
  })

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

  const workspaceMutations = {
    create: createWorkspaceMutation,
    update: updateWorkspaceMutation,
    delete: deleteWorkspaceMutation,
  }

  const createWorkspace = () => {
    if (!isAuthenticated || workspaceMutations.create.isPending) {
      return
    }

    const nextNumber = workspaces.length + 1
    workspaceMutations.create.mutate({
      title: `New Workspace ${nextNumber}`,
      rootNodeTitle: 'Root decision',
      rootNodeSummary: '',
    })
  }

  const isCollapsed = useAppSelector(selectSidebarCollapsed)
  const setIsCollapsed = (val: boolean) => dispatch(setSidebarCollapsed(val))

  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })
  const createButtonRef = useRef<HTMLButtonElement>(null)

  const [contextMenu, setContextMenu] = useState<{
    workspaceId: string
    workspaceTitle: string
    x: number
    y: number
  } | null>(null)
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
    setContextMenu(null)
  }

  const toggleCreatePopover = () => {
    const anchorRect = createButtonRef.current?.getBoundingClientRect()
    if (anchorRect) {
      setPopoverPosition({ top: anchorRect.bottom + 6, left: anchorRect.left })
    }
    setIsPopoverOpen((current) => !current)
  }

  const currentUserName = isAuthBootstrapPending ? '...' : (authUser?.displayName ?? 'Guest')
  const avatarInitial = currentUserName.trim().slice(0, 1).toUpperCase() || '?'
  const workspaceActionError = workspaceMutations.create.error?.message ?? null

  return (
    <>
    <aside
      className={`flex min-h-0 flex-col border-b border-slate-200 bg-white transition-[width] duration-300 ease-in-out lg:min-h-screen lg:border-r lg:border-b-0 ${isCollapsed ? 'lg:w-10 lg:overflow-hidden' : 'lg:w-[272px]'}`}
      aria-label="Workspace navigation"
    >
      {/* Collapsed strip — desktop only */}
      <div className={`hidden flex-1 flex-col items-center justify-between py-2.5 ${isCollapsed ? 'lg:flex' : ''}`}>
        <button
          type="button"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          onClick={() => setIsCollapsed(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        </button>

        <span
          className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-full bg-slate-900 text-[13px] font-bold text-white shadow-sm"
          title={currentUserName}
          aria-label={currentUserName}
        >
          {avatarInitial}
        </span>
      </div>

      <section className={`flex min-h-0 flex-1 flex-col ${isCollapsed ? 'lg:hidden' : ''}`}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Workspaces
          </h2>
          <div className="flex items-center gap-1">
            <button
              ref={createButtonRef}
              type="button"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-950 bg-slate-950 text-xl text-white shadow-sm transition-colors duration-150 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={toggleCreatePopover}
              aria-label="Create workspace"
              disabled={!isAuthenticated || isAuthBootstrapPending}
            >
              +
            </button>
            <button
              type="button"
              className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-sm leading-none text-slate-600 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 lg:flex"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeftIcon sx={{ fontSize: 16 }} />
            </button>
          </div>
        </header>

        <ul className="m-0 flex max-h-[220px] list-none flex-col gap-2 overflow-y-auto p-3 lg:max-h-none">
          {isWorkspacesLoading && workspaces.length === 0 ? (
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-500">
              Loading workspaces...
            </li>
          ) : workspaces.length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-500">
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
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={saveRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 text-[13px] font-semibold text-slate-900 outline-none ring-4 ring-blue-500/10"
                    />
                  ) : (
                    <button
                      type="button"
                      className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition ${
                        isActive
                          ? 'border-blue-200 bg-blue-50 shadow-sm'
                          : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => dispatch(setActiveWorkspaceId(workspace.id))}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ workspaceId: workspace.id, workspaceTitle: workspace.title, x: e.clientX, y: e.clientY })
                      }}
                    >
                      <span className="truncate text-[13px] font-semibold text-slate-900">
                        {workspace.title}
                      </span>
                      <small className="line-clamp-2 text-[11px] leading-snug text-slate-500">{workspaceSummary}</small>
                    </button>
                  )}
                </li>
              )
            })
          )}
        </ul>
      </section>

      <section className={`border-t border-slate-200 px-4 py-3 ${isCollapsed ? 'lg:hidden' : ''}`}>
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[13px] font-bold text-white"
              aria-hidden="true"
            >
              {avatarInitial}
            </span>
            <p className="m-0 truncate text-sm font-semibold text-slate-900">{currentUserName}</p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={isAuthenticated ? () => void logout() : () => void login()}
            disabled={isAuthActionPending || isAuthBootstrapPending}
          >
            {isAuthBootstrapPending
              ? 'Checking...'
              : isAuthActionPending
                ? 'Working...'
                : isAuthenticated
                  ? 'Logout'
                  : 'Login'}
          </button>
        </div>
        <CreditBalanceIndicator />
        {authError && !isAuthBootstrapPending ? (
          <p className="mt-2 mb-0 text-[11px] text-red-700">{authError}</p>
        ) : workspaceActionError ? (
          <p className="mt-2 mb-0 text-[11px] text-red-700">{workspaceActionError}</p>
        ) : null}
      </section>
    </aside>

    {contextMenu && (
      <WorkspaceContextMenu
        workspaceTitle={contextMenu.workspaceTitle}
        x={contextMenu.x}
        y={contextMenu.y}
        onRename={() => startRename(contextMenu.workspaceId, contextMenu.workspaceTitle)}
        onDelete={() => handleDelete(contextMenu.workspaceId)}
        onClose={() => setContextMenu(null)}
        isDeletePending={deleteWorkspaceMutation.isPending}
      />
    )}
    {isPopoverOpen && (
      <CreateWorkspacePopover
        anchorRef={createButtonRef}
        position={popoverPosition}
        onCreateBlank={createWorkspace}
        onClose={() => setIsPopoverOpen(false)}
      />
    )}
    </>
  )
}
