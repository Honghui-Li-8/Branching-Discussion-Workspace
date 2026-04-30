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
import { useAuth } from './AuthProvider'
import { trpc } from '../trpc'

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

  const currentUserName = isAuthBootstrapPending ? '...' : (authUser?.displayName ?? 'Guest')
  const avatarInitial = currentUserName.trim().slice(0, 1).toUpperCase() || '?'
  const workspaceActionError = workspaceMutations.create.error?.message ?? null

  return (
    <>
    <aside
      className={`flex min-h-0 flex-col border-b border-[#b8dced] bg-[linear-gradient(180deg,#d9f0fd_0%,#e9f7ff_100%)] transition-[width] duration-300 ease-in-out lg:min-h-screen lg:border-r lg:border-b-0 ${isCollapsed ? 'lg:w-10 lg:overflow-hidden' : 'lg:w-[240px]'}`}
      aria-label="Workspace navigation"
    >
      {/* Collapsed strip — desktop only */}
      <div className={`hidden flex-1 flex-col items-center justify-between py-2.5 ${isCollapsed ? 'lg:flex' : ''}`}>
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl border border-[#6ea9c7] bg-white/70 text-[#1f607d] hover:bg-white hover:border-[#185270] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5da8d2]/50"
          onClick={() => setIsCollapsed(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        </button>

        <span
          className="inline-flex h-[26px] w-[26px] cursor-default items-center justify-center rounded-full border border-[#97c2d8] bg-white text-[13px] font-bold text-[#225c79] shadow-sm"
          title={currentUserName}
          aria-label={currentUserName}
        >
          {avatarInitial}
        </span>
      </div>

      <section className={`flex min-h-0 flex-1 flex-col ${isCollapsed ? 'lg:hidden' : ''}`}>
        <header className="flex items-center justify-between gap-2.5 border-b border-[#b8dced] px-2.5 pt-2.5 pb-2">
          <h2 className="m-0 text-[11px] uppercase tracking-[0.1em] text-[#1f607d]">
            Workspaces
          </h2>
          <div className="flex items-center gap-1">
            <button
              ref={createButtonRef}
              type="button"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl border border-[#185270] bg-[#1f607d] text-xl text-white hover:bg-[#185270] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5da8d2]/50"
              onClick={() => setIsPopoverOpen((v) => !v)}
              aria-label="Create workspace"
              disabled={!isAuthenticated || isAuthBootstrapPending}
            >
              +
            </button>
            <button
              type="button"
              className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-xl border border-[#6ea9c7] bg-white text-sm leading-none text-[#1f607d] hover:bg-[#eef9ff] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5da8d2]/50 lg:flex"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeftIcon sx={{ fontSize: 16 }} />
            </button>
          </div>
        </header>

        <ul className="m-0 flex max-h-[220px] list-none flex-col gap-[7px] overflow-y-auto p-2 lg:max-h-none">
          {isWorkspacesLoading && workspaces.length === 0 ? (
            <li className="rounded-xl border border-[#a6cee1] bg-[#fbfeff] px-2.5 py-2.5 text-[12px] text-[#40718a]">
              Loading workspaces...
            </li>
          ) : workspaces.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#a6cee1] bg-[#fbfeff] px-2.5 py-2.5 text-[12px] text-[#40718a]">
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
                      className="w-full rounded-xl border border-[#ffbe62] bg-[#fff8eb] px-2.5 py-2.5 text-[13px] font-semibold text-[#12384c] outline-none ring-2 ring-[#ffbe62]/30"
                    />
                  ) : (
                    <button
                      type="button"
                      className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-xl border px-2.5 py-2.5 text-left transition ${
                        isActive
                          ? 'border-[#ffbe62] bg-[#fff8eb]'
                          : 'border-[#a6cee1] bg-[#fbfeff] hover:border-[#7eb9d5] hover:bg-[#f2fbff]'
                      }`}
                      onClick={() => dispatch(setActiveWorkspaceId(workspace.id))}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ workspaceId: workspace.id, workspaceTitle: workspace.title, x: e.clientX, y: e.clientY })
                      }}
                    >
                      <span className="text-[13px] font-semibold text-[#12384c]">
                        {workspace.title}
                      </span>
                      <small className="text-[11px] text-[#40718a]">{workspaceSummary}</small>
                    </button>
                  )}
                </li>
              )
            })
          )}
        </ul>
      </section>

      <section className={`border-t border-[#b8dced] px-3 py-3 ${isCollapsed ? 'lg:hidden' : ''}`}>
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[#97c2d8] bg-white text-[13px] font-bold text-[#225c79]"
              aria-hidden="true"
            >
              {avatarInitial}
            </span>
            <p className="m-0 text-sm font-semibold text-[#164760]">{currentUserName}</p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-xl border border-[#6ea9c7] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#1f607d] hover:bg-[#eef9ff] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5da8d2]/50 disabled:cursor-not-allowed disabled:opacity-60"
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
        {authError && !isAuthBootstrapPending ? (
          <p className="mt-2 mb-0 text-[11px] text-[#8a3f2b]">{authError}</p>
        ) : workspaceActionError ? (
          <p className="mt-2 mb-0 text-[11px] text-[#8a3f2b]">{workspaceActionError}</p>
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
        onCreateBlank={createWorkspace}
        onClose={() => setIsPopoverOpen(false)}
      />
    )}
    </>
  )
}
