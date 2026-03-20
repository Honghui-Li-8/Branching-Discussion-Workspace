import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  createWorkspace,
  selectActiveWorkspaceId,
  selectWorkspaces,
  setActiveWorkspaceId,
} from '../store/slices/appShellSlice'
import { selectAuthUser } from '../store/slices/authSlice'

export const AppSidebar = () => {
  const dispatch = useAppDispatch()
  const workspaces = useAppSelector(selectWorkspaces)
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId)
  const authUser = useAppSelector(selectAuthUser)
  const currentUserName = authUser?.displayName ?? 'User'
  const avatarInitial = currentUserName.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <aside
      className="flex min-h-0 flex-col border-b border-[#b8dced] bg-[linear-gradient(180deg,#d9f0fd_0%,#e9f7ff_100%)] lg:min-h-screen lg:border-r lg:border-b-0"
      aria-label="Workspace navigation"
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2.5 border-b border-[#b8dced] px-2.5 pt-2.5 pb-2">
          <h2 className="m-0 text-[11px] uppercase tracking-[0.1em] text-[#1f607d]">
            Workspaces
          </h2>
          <button
            type="button"
            className="h-7 w-7 cursor-pointer rounded-[10px] border border-[#6ea9c7] bg-[#fbfeff] text-xl leading-none text-[#1f607d] transition hover:bg-[#eef9ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffad3f]"
            onClick={() => dispatch(createWorkspace())}
            aria-label="Create workspace"
          >
            +
          </button>
        </header>

        <ul className="m-0 flex max-h-[220px] list-none flex-col gap-[7px] overflow-y-auto p-2 lg:max-h-none">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId

            return (
              <li key={workspace.id}>
                <button
                  type="button"
                  className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-[10px] border px-2.5 py-2.5 text-left transition ${
                    isActive
                      ? 'border-[#ffbe62] bg-[#fff8eb]'
                      : 'border-[#a6cee1] bg-[#fbfeff] hover:border-[#7eb9d5] hover:bg-[#f2fbff]'
                  }`}
                  onClick={() => dispatch(setActiveWorkspaceId(workspace.id))}
                >
                  <span className="text-[13px] font-semibold text-[#12384c]">
                    {workspace.title}
                  </span>
                  <small className="text-[11px] text-[#40718a]">{workspace.summary}</small>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="border-t border-[#b8dced] px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[#97c2d8] bg-white text-[13px] font-bold text-[#225c79]"
            aria-hidden="true"
          >
            {avatarInitial}
          </span>
          <p className="m-0 text-sm font-semibold text-[#164760]">{currentUserName}</p>
        </div>
      </section>
    </aside>
  )
}
