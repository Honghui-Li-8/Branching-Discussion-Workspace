import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ExampleWorkspaceKey } from '@branching/shared/router/schemas/core'
import type { RootState } from '..'

/** Which create action is in flight: a blank workspace or one of the examples. */
export type CreatePendingKey = 'blank' | ExampleWorkspaceKey

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
  /**
   * The in-flight create (A10). Shared, not per-component: the sidebar popover
   * and the empty state are two entry points to one create model, so either
   * one's request must hold both to one action at a time.
   */
  createPendingKey: CreatePendingKey | null
}

const initialState: AppShellState = {
  workspaces: [],
  activeWorkspaceId: null,
  openNodeId: null,
  isWorkspacesLoading: false,
  isSidebarCollapsed: false,
  createPendingKey: null,
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
    setCreatePendingKey: (state, action: PayloadAction<CreatePendingKey | null>) => {
      state.createPendingKey = action.payload
    },
  },
})

export const {
  setWorkspaces,
  setWorkspacesLoading,
  setActiveWorkspaceId,
  setOpenNodeId,
  setSidebarCollapsed,
  setCreatePendingKey,
} = appShellSlice.actions

export const selectWorkspaces = (state: RootState) => state.appShell.workspaces
export const selectActiveWorkspaceId = (state: RootState) => state.appShell.activeWorkspaceId
export const selectOpenNodeId = (state: RootState) => state.appShell.openNodeId
export const selectWorkspacesLoading = (state: RootState) => state.appShell.isWorkspacesLoading
export const selectSidebarCollapsed = (state: RootState) => state.appShell.isSidebarCollapsed
export const selectCreatePendingKey = (state: RootState) => state.appShell.createPendingKey
export const selectActiveWorkspace = (state: RootState) =>
  state.appShell.activeWorkspaceId
    ? state.appShell.workspaces.find((workspace) => workspace.id === state.appShell.activeWorkspaceId) ?? null
    : null

export default appShellSlice.reducer
