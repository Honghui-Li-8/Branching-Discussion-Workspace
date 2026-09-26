import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '..'

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'

export type AuthUser = {
  id: string
  authUserId: string
  email: string | null
  displayName: string | null
  creditBalance: number
}

/** Why the client was signed out, when the user did not ask for it (A10). */
export type SignedOutReason = 'session-expired'

type AuthState = {
  status: AuthStatus
  user: AuthUser | null
  /** Set when the server ended the session; cleared on sign-in or when the notice is dismissed. */
  signedOutReason: SignedOutReason | null
}

const initialState: AuthState = {
  status: 'unknown',
  user: null,
  signedOutReason: null,
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
      if (action.payload.status === 'authenticated') state.signedOutReason = null
    },
    setAuthenticatedUser: (state, action: PayloadAction<AuthUser>) => {
      state.status = 'authenticated'
      state.user = action.payload
      state.signedOutReason = null
    },
    clearAuthenticatedUser: (state, action: PayloadAction<{ reason: SignedOutReason } | undefined>) => {
      state.status = 'unauthenticated'
      state.user = null
      state.signedOutReason = action.payload?.reason ?? null
    },
    dismissSignedOutReason: (state) => {
      state.signedOutReason = null
    },
  },
})

export const { setAuthState, setAuthenticatedUser, clearAuthenticatedUser, dismissSignedOutReason } =
  authSlice.actions

export const selectAuth = (state: RootState) => state.auth
export const selectAuthStatus = (state: RootState) => state.auth.status
export const selectAuthUser = (state: RootState) => state.auth.user
export const selectSignedOutReason = (state: RootState) => state.auth.signedOutReason

export default authSlice.reducer
