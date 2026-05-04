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
}

export const AuthContext = createContext<AuthContextValue | null>(null)
