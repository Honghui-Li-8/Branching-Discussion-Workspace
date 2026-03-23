import { useEffect, useMemo, type ReactNode } from 'react'
import { trpc } from '../trpc'
import { useAppDispatch, useAppSelector } from '../store/hooks'
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
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId)
  const workspacesQuery = trpc.workspacesList.useQuery()

  const workspaces = useMemo(
    () =>
      workspacesQuery.data?.map((workspace) => ({
        id: workspace.id,
        title: workspace.title,
      })) ?? null,
    [workspacesQuery.data],
  )

  useEffect(() => {
    dispatch(setWorkspacesLoading(workspacesQuery.isLoading))
  }, [dispatch, workspacesQuery.isLoading])

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
