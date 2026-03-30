import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '..'

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'

export type AuthUser = {
  id: string
  authUserId: string
  email: string | null
  displayName: string | null
}

type AuthState = {
  status: AuthStatus
  user: AuthUser | null
}

const initialState: AuthState = {
  status: 'unknown',
  user: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthState: (
      state,
      action: PayloadAction<{ status: AuthStatus; user: AuthUser | null }>,
    ) => {
      state.status = action.payload.status
      state.user = action.payload.user
    },
    setAuthenticatedUser: (state, action: PayloadAction<AuthUser>) => {
      state.status = 'authenticated'
      state.user = action.payload
    },
    clearAuthenticatedUser: (state) => {
      state.status = 'unauthenticated'
      state.user = null
    },
  },
})

export const { setAuthState, setAuthenticatedUser, clearAuthenticatedUser } = authSlice.actions

export const selectAuth = (state: RootState) => state.auth
export const selectAuthStatus = (state: RootState) => state.auth.status
export const selectAuthUser = (state: RootState) => state.auth.user

export default authSlice.reducer
