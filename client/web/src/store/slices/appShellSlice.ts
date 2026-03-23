import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '..'

type WorkspaceNavItem = {
  id: string
  title: string
}

type AppShellState = {
  workspaces: WorkspaceNavItem[]
  activeWorkspaceId: string | null
  isWorkspacesLoading: boolean
}

const initialState: AppShellState = {
  workspaces: [],
  activeWorkspaceId: null,
  isWorkspacesLoading: false,
}

const appShellSlice = createSlice({
  name: 'appShell',
  initialState,
  reducers: {
    setWorkspaces: (state, action: PayloadAction<WorkspaceNavItem[]>) => {
      state.workspaces = action.payload
    },
    setWorkspacesLoading: (state, action: PayloadAction<boolean>) => {
      state.isWorkspacesLoading = action.payload
    },
    setActiveWorkspaceId: (state, action: PayloadAction<string | null>) => {
      state.activeWorkspaceId = action.payload
    },
  },
})

export const { setWorkspaces, setWorkspacesLoading, setActiveWorkspaceId } = appShellSlice.actions

export const selectWorkspaces = (state: RootState) => state.appShell.workspaces
export const selectActiveWorkspaceId = (state: RootState) => state.appShell.activeWorkspaceId
export const selectWorkspacesLoading = (state: RootState) => state.appShell.isWorkspacesLoading
export const selectActiveWorkspace = (state: RootState) =>
  state.appShell.activeWorkspaceId
    ? state.appShell.workspaces.find((workspace) => workspace.id === state.appShell.activeWorkspaceId) ?? null
    : null

export default appShellSlice.reducer
