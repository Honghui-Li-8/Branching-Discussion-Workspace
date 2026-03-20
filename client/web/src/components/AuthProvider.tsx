import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  clearAuthenticatedUser,
  selectAuthStatus,
  selectAuthUser,
  setAuthenticatedUser,
  type AuthUser,
} from '../store/slices/authSlice'

type AuthContextValue = {
  authUser: AuthUser | null
  isAuthenticated: boolean
  isAuthActionPending: boolean
  authError: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<AuthUser>
  const emailIsValid = typeof candidate.email === 'string' || candidate.email === null
  const displayNameIsValid =
    typeof candidate.displayName === 'string' || candidate.displayName === null

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.authUserId === 'string' &&
    emailIsValid &&
    displayNameIsValid
  )
}

type AuthProviderProps = {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const dispatch = useAppDispatch()
  const authStatus = useAppSelector(selectAuthStatus)
  const authUser = useAppSelector(selectAuthUser)

  const [isAuthActionPending, setIsAuthActionPending] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
  const devToken =
    import.meta.env.VITE_DEV_AUTH_TOKEN ?? import.meta.env.VITE_BACKDOOR_AUTH_TOKEN ?? ''

  const isAuthenticated = authStatus === 'authenticated' && authUser !== null

  const login = async (): Promise<void> => {
    if (isAuthActionPending) {
      return
    }

    setAuthError(null)
    setIsAuthActionPending(true)

    try {
      if (!devToken) {
        throw new Error('VITE_DEV_AUTH_TOKEN is missing.')
      }

      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: devToken }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        authenticated?: unknown
        user?: unknown
        error?: unknown
      }

      if (!response.ok) {
        const serverError = typeof payload.error === 'string' ? payload.error : 'Unable to sign in.'
        throw new Error(serverError)
      }

      if (payload.authenticated !== true || !isAuthUser(payload.user)) {
        throw new Error('Unexpected login response.')
      }

      dispatch(setAuthenticatedUser(payload.user))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.'
      setAuthError(message)
    } finally {
      setIsAuthActionPending(false)
    }
  }

  const logout = async (): Promise<void> => {
    if (isAuthActionPending) {
      return
    }

    setAuthError(null)
    setIsAuthActionPending(true)

    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to sign out.')
      }

      dispatch(clearAuthenticatedUser())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out.'
      setAuthError(message)
    } finally {
      setIsAuthActionPending(false)
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      authUser,
      isAuthenticated,
      isAuthActionPending,
      authError,
      login,
      logout,
    }),
    [authUser, isAuthenticated, isAuthActionPending, authError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }
  return context
}
