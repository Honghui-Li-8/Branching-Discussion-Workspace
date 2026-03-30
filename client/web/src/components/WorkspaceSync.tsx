import { useEffect, useMemo, type ReactNode } from 'react'
import { trpc } from '../trpc'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { selectAuthStatus } from '../store/slices/authSlice'
import {
  selectActiveWorkspaceId,
  setActiveWorkspaceId,
  setWorkspaces,
  setWorkspacesLoading,
} from '../store/slices/appShellSlice'

type WorkspaceSyncProps = {
  children: ReactNode
}

export const WorkspaceSync = ({ children }: WorkspaceSyncProps) => {
  const dispatch = useAppDispatch()
  const authStatus = useAppSelector(selectAuthStatus)
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId)
  const isAuthenticated = authStatus === 'authenticated'
  const workspacesQuery = trpc.workspacesList.useQuery(undefined, {
    enabled: isAuthenticated,
  })

  const workspaces = useMemo(
    () =>
      workspacesQuery.data?.map((workspace) => ({
        id: workspace.id,
        title: workspace.title,
        summary: workspace.summary,
      })) ?? null,
    [workspacesQuery.data],
  )

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      dispatch(setWorkspacesLoading(false))
      dispatch(setWorkspaces([]))
      dispatch(setActiveWorkspaceId(null))
      return
    }

    if (authStatus === 'unknown') {
      dispatch(setWorkspacesLoading(true))
      return
    }

    dispatch(setWorkspacesLoading(workspacesQuery.isLoading))
  }, [authStatus, dispatch, workspacesQuery.isLoading])

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

    if (workspaces.length === 0) {
      if (activeWorkspaceId !== null) {
        dispatch(setActiveWorkspaceId(null))
      }
      return
    }

    if (!activeWorkspaceId) {
      dispatch(setActiveWorkspaceId(workspaces[0].id))
      return
    }

    const activeWorkspaceExists = workspaces.some((workspace) => workspace.id === activeWorkspaceId)
    if (!activeWorkspaceExists) {
      dispatch(setActiveWorkspaceId(workspaces[0].id))
    }
  }, [activeWorkspaceId, dispatch, workspaces])

  return children
}
