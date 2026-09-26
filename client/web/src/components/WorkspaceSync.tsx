import { useEffect, useMemo, type ReactNode } from 'react'
import { trpc } from '../trpc'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { selectAuthStatus } from '../store/slices/authSlice'
import {
  endCreate,
  selectActiveWorkspaceId,
  selectWorkspaces,
  setActiveWorkspaceId,
  setWorkspaces,
  setWorkspacesLoadFailed,
  setWorkspacesLoading,
} from '../store/slices/appShellSlice'

import { toWorkspaceNavItems } from './workspaceNavItems'

type WorkspaceSyncProps = {
  children: ReactNode
}

export const WorkspaceSync = ({ children }: WorkspaceSyncProps) => {
  const dispatch = useAppDispatch()
  const authStatus = useAppSelector(selectAuthStatus)
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId)
  const storeWorkspaces = useAppSelector(selectWorkspaces)
  const isAuthenticated = authStatus === 'authenticated'
  const workspacesQuery = trpc.workspacesList.useQuery(undefined, {
    enabled: isAuthenticated,
  })

  const workspaces = useMemo(
    () => (workspacesQuery.data ? toWorkspaceNavItems(workspacesQuery.data) : null),
    [workspacesQuery.data],
  )

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      dispatch(setWorkspacesLoading(false))
      dispatch(setWorkspacesLoadFailed(false))
      dispatch(setWorkspaces([]))
      dispatch(setActiveWorkspaceId(null))
      // Every sign-out lands here — logout, an expired session, a failed
      // bootstrap — so the create lock is released here, not per path.
      dispatch(endCreate())
      return
    }

    if (authStatus === 'unknown') {
      dispatch(setWorkspacesLoading(true))
      return
    }

    dispatch(setWorkspacesLoading(workspacesQuery.isLoading))
    // A failure with a list already in hand keeps showing that list; only a
    // failure with nothing to show is surfaced, so it is never mistaken for
    // "no workspaces yet".
    dispatch(setWorkspacesLoadFailed(workspacesQuery.isError && !workspacesQuery.data))
  }, [authStatus, dispatch, workspacesQuery.isLoading, workspacesQuery.isError, workspacesQuery.data])

  useEffect(() => {
    if (workspaces === null) {
      return
    }

    dispatch(setWorkspaces(workspaces))
  }, [dispatch, workspaces])

  useEffect(() => {
    if (workspaces === null) {
      return
    }

    // A workspace written to the store ahead of the query (the create hook,
    // A10) is known too: a store change re-renders this component before
    // React Query has delivered the refetched list, and judging by the query
    // alone reset a just-created selection — to the first row, or to nothing
    // when the query still said the list was empty. The store catches up on
    // the next render, so a stale extra entry costs at most one render.
    const known = workspaces.length > 0 ? workspaces : storeWorkspaces
    const knownIds = new Set([...workspaces, ...storeWorkspaces].map((workspace) => workspace.id))

    if (knownIds.size === 0) {
      if (activeWorkspaceId !== null) {
        dispatch(setActiveWorkspaceId(null))
      }
      return
    }

    if (!activeWorkspaceId || !knownIds.has(activeWorkspaceId)) {
      dispatch(setActiveWorkspaceId(known[0].id))
    }
  }, [activeWorkspaceId, dispatch, storeWorkspaces, workspaces])

  return children
}
