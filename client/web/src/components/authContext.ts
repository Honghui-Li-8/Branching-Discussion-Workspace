import { createContext } from 'react'
import type { AuthUser } from '../store/slices/authSlice'

export type AuthContextValue = {
  authUser: AuthUser | null
  isAuthenticated: boolean
  isAuthBootstrapPending: boolean
  isAuthActionPending: boolean
  authError: string | null
  setAuthError: (message: string | null) => void
  login: () => Promise<void>
  logout: () => Promise<void>
  refreshBalance: () => Promise<void>
  /** Resolves true only when a session was actually established; false when the guard declined. */
  loginWithLocalBypass: () => Promise<boolean>
  isLocalBypassPending: boolean
  localBypassError: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
