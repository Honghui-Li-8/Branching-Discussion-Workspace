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
  /** The node whose conversation is open (A10b): shared by the canvas and the sidebar outline. */
  openNodeId: string | null
  isWorkspacesLoading: boolean
  isSidebarCollapsed: boolean
}

const initialState: AppShellState = {
  workspaces: [],
  activeWorkspaceId: null,
  openNodeId: null,
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
      if (state.activeWorkspaceId !== action.payload) {
        // A node id belongs to one workspace; switching workspaces closes it.
        state.openNodeId = null
      }
      state.activeWorkspaceId = action.payload
    },
    setOpenNodeId: (state, action: PayloadAction<string | null>) => {
      state.openNodeId = action.payload
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isSidebarCollapsed = action.payload
    },
  },
})

export const { setWorkspaces, setWorkspacesLoading, setActiveWorkspaceId, setOpenNodeId, setSidebarCollapsed } =
  appShellSlice.actions

export const selectWorkspaces = (state: RootState) => state.appShell.workspaces
export const selectActiveWorkspaceId = (state: RootState) => state.appShell.activeWorkspaceId
export const selectOpenNodeId = (state: RootState) => state.appShell.openNodeId
export const selectWorkspacesLoading = (state: RootState) => state.appShell.isWorkspacesLoading
export const selectSidebarCollapsed = (state: RootState) => state.appShell.isSidebarCollapsed
export const selectActiveWorkspace = (state: RootState) =>
  state.appShell.activeWorkspaceId
    ? state.appShell.workspaces.find((workspace) => workspace.id === state.appShell.activeWorkspaceId) ?? null
    : null

export default appShellSlice.reducer
