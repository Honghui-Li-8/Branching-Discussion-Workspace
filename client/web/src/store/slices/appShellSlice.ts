import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '..'

type WorkspaceNavItem = {
  id: string
  title: string
  summary: string | null
}

type AppShellState = {
  workspaces: WorkspaceNavItem[]
  activeWorkspaceId: string | null
  isWorkspacesLoading: boolean
  isSidebarCollapsed: boolean
}

const initialState: AppShellState = {
  workspaces: [],
  activeWorkspaceId: null,
  isWorkspacesLoading: false,
  isSidebarCollapsed: false,
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
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isSidebarCollapsed = action.payload
    },
  },
})

export const { setWorkspaces, setWorkspacesLoading, setActiveWorkspaceId, setSidebarCollapsed } = appShellSlice.actions

export const selectWorkspaces = (state: RootState) => state.appShell.workspaces
export const selectActiveWorkspaceId = (state: RootState) => state.appShell.activeWorkspaceId
export const selectWorkspacesLoading = (state: RootState) => state.appShell.isWorkspacesLoading
export const selectSidebarCollapsed = (state: RootState) => state.appShell.isSidebarCollapsed
export const selectActiveWorkspace = (state: RootState) =>
  state.appShell.activeWorkspaceId
    ? state.appShell.workspaces.find((workspace) => workspace.id === state.appShell.activeWorkspaceId) ?? null
    : null

export default appShellSlice.reducer
