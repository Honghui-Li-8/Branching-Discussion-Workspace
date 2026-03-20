import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { initialWorkspaces } from '../../data/mockWorkspaces'
import type { Workspace } from '../../types/workspace'
import type { RootState } from '..'

type AppShellState = {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
}

const initialState: AppShellState = {
  workspaces: initialWorkspaces,
  activeWorkspaceId: null,
}

const appShellSlice = createSlice({
  name: 'appShell',
  initialState,
  reducers: {
    setWorkspaces: (state, action: PayloadAction<Workspace[]>) => {
      state.workspaces = action.payload
      if (!action.payload.some((workspace) => workspace.id === state.activeWorkspaceId)) {
        state.activeWorkspaceId = null
      }
    },
    setActiveWorkspaceId: (state, action: PayloadAction<string | null>) => {
      state.activeWorkspaceId = action.payload
    },
    createWorkspace: (state) => {
      const nextNumber = state.workspaces.length + 1
      const newWorkspace: Workspace = {
        id: `workspace-${Date.now()}`,
        title: `New Workspace ${nextNumber}`,
        summary: 'New decision workspace',
      }

      state.workspaces.unshift(newWorkspace)
      state.activeWorkspaceId = newWorkspace.id
    },
  },
})

export const { setWorkspaces, setActiveWorkspaceId, createWorkspace } = appShellSlice.actions

export const selectWorkspaces = (state: RootState) => state.appShell.workspaces
export const selectActiveWorkspaceId = (state: RootState) => state.appShell.activeWorkspaceId
export const selectActiveWorkspace = (state: RootState) =>
  state.appShell.workspaces.find((workspace) => workspace.id === state.appShell.activeWorkspaceId) ??
  null

export default appShellSlice.reducer
