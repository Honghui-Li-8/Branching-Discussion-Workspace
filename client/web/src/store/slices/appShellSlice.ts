import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ExampleWorkspaceKey } from '@branching/shared/router/schemas/core'
import type { RootState } from '..'

/** Which create action is in flight: a blank workspace or one of the examples. */
export type CreatePendingKey = 'blank' | ExampleWorkspaceKey

type WorkspaceNavItem = {
  id: string
  title: string
  summary: string | null
  /** ISO timestamp of the last change; null when the source row lacks one. */
  updatedAt: string | null
}

type AppShellState = {
  workspaces: WorkspaceNavItem[]
  activeWorkspaceId: string | null
  isWorkspacesLoading: boolean
  /** The workspace list could not be loaded and nothing is cached: say so and offer a retry (A10). */
  isWorkspacesLoadFailed: boolean
  isSidebarCollapsed: boolean
  /**
   * The in-flight create (A10). Shared, not per-component: the sidebar popover
   * and the empty state are two entry points to one create model, so either
   * one's request must hold both to one action at a time.
   */
  createPendingKey: CreatePendingKey | null
  /**
   * Which request holds that lock. Sign-out releases it, so a create whose
   * session ended can tell, when it lands, that it no longer owns the shell.
   */
  createRequestId: string | null
}

const initialState: AppShellState = {
  workspaces: [],
  activeWorkspaceId: null,
  isWorkspacesLoading: false,
  isWorkspacesLoadFailed: false,
  isSidebarCollapsed: false,
  createPendingKey: null,
  createRequestId: null,
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
    setWorkspacesLoadFailed: (state, action: PayloadAction<boolean>) => {
      state.isWorkspacesLoadFailed = action.payload
    },
    setActiveWorkspaceId: (state, action: PayloadAction<string | null>) => {
      state.activeWorkspaceId = action.payload
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isSidebarCollapsed = action.payload
    },
    startCreate: (state, action: PayloadAction<{ key: CreatePendingKey; requestId: string }>) => {
      state.createPendingKey = action.payload.key
      state.createRequestId = action.payload.requestId
    },
    endCreate: (state) => {
      state.createPendingKey = null
      state.createRequestId = null
    },
  },
})

export const {
  setWorkspaces,
  setWorkspacesLoading,
  setWorkspacesLoadFailed,
  setActiveWorkspaceId,
  setSidebarCollapsed,
  startCreate,
  endCreate,
} = appShellSlice.actions

export const selectWorkspaces = (state: RootState) => state.appShell.workspaces
export const selectActiveWorkspaceId = (state: RootState) => state.appShell.activeWorkspaceId
export const selectWorkspacesLoading = (state: RootState) => state.appShell.isWorkspacesLoading
export const selectWorkspacesLoadFailed = (state: RootState) => state.appShell.isWorkspacesLoadFailed
export const selectSidebarCollapsed = (state: RootState) => state.appShell.isSidebarCollapsed
export const selectCreatePendingKey = (state: RootState) => state.appShell.createPendingKey
export const selectCreateRequestId = (state: RootState) => state.appShell.createRequestId
export const selectActiveWorkspace = (state: RootState) =>
  state.appShell.activeWorkspaceId
    ? state.appShell.workspaces.find((workspace) => workspace.id === state.appShell.activeWorkspaceId) ?? null
    : null

export default appShellSlice.reducer
