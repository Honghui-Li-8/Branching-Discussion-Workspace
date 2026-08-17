import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  clearAuthenticatedUser,
  setAuthState,
  selectAuthStatus,
  selectAuthUser,
} from '../store/slices/authSlice'
import { getSupabaseClient } from '../lib/supabaseClient'
import { AuthContext, type AuthContextValue } from './authContext'
import { isAuthUser } from './authCallbackLogic'
import { runLocalBypassLogin } from './localBypassLogin'

type AuthProviderProps = {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const dispatch = useAppDispatch()
  const authStatus = useAppSelector(selectAuthStatus)
  const authUser = useAppSelector(selectAuthUser)

  const [isAuthActionPending, setIsAuthActionPending] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLocalBypassPending, setIsLocalBypassPending] = useState(false)
  const [localBypassError, setLocalBypassError] = useState<string | null>(null)

  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

  const isAuthenticated = authStatus === 'authenticated' && authUser !== null
  const isAuthBootstrapPending = authStatus === 'unknown'

  useEffect(() => {
    if (authStatus !== 'unknown') {
      return
    }

    let isCancelled = false

    const bootstrapAuth = async (): Promise<void> => {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          method: 'GET',
          credentials: 'include',
        })

        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: unknown
          user?: unknown
        }

        if (isCancelled) {
          return
        }

        if (response.ok && payload.authenticated === true && isAuthUser(payload.user)) {
          dispatch(setAuthState({ status: 'authenticated', user: payload.user }))
          return
        }

        dispatch(setAuthState({ status: 'unauthenticated', user: null }))
      } catch {
        if (isCancelled) {
          return
        }

        dispatch(setAuthState({ status: 'unauthenticated', user: null }))
      }
    }

    void bootstrapAuth()

    return () => {
      isCancelled = true
    }
  }, [apiBaseUrl, authStatus, dispatch])

  const login = useCallback(async (): Promise<void> => {
    if (isAuthBootstrapPending) {
      return
    }

    setAuthError(null)

    try {
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setAuthError(error.message || 'Unable to sign in.')
        throw error
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'Supabase is not configured.'
          ? 'Sign-in is not configured yet.'
          : error instanceof Error
            ? error.message
            : 'Unable to sign in.'
      setAuthError(message)
      throw error
    }
  }, [isAuthBootstrapPending])

  const logout = useCallback(async (): Promise<void> => {
    if (isAuthActionPending || isAuthBootstrapPending) {
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
  }, [apiBaseUrl, dispatch, isAuthActionPending, isAuthBootstrapPending])

  const loginWithLocalBypass = useCallback(async (): Promise<void> => {
    if (isAuthBootstrapPending || isLocalBypassPending) {
      return
    }

    setLocalBypassError(null)
    setIsLocalBypassPending(true)

    try {
      await runLocalBypassLogin({
        postLogin: async () => {
          const response = await fetch(`${apiBaseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: import.meta.env.VITE_DEV_AUTH_TOKEN }),
          })
          const payload = (await response.json().catch(() => ({}))) as {
            authenticated?: unknown
            user?: unknown
            error?: unknown
          }

          return { ok: response.ok, payload }
        },
        dispatchAuthUser: (user) => dispatch(setAuthState({ status: 'authenticated', user })),
        setError: setLocalBypassError,
      })
    } finally {
      setIsLocalBypassPending(false)
    }
  }, [apiBaseUrl, dispatch, isAuthBootstrapPending, isLocalBypassPending])

  const refreshBalance = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as {
        authenticated?: unknown
        user?: unknown
      }
      if (response.ok && payload.authenticated === true && isAuthUser(payload.user)) {
        dispatch(setAuthState({ status: 'authenticated', user: payload.user }))
      }
    } catch {
      // silent — balance will update on next successful /auth/me
    }
  }, [apiBaseUrl, dispatch])

  const value = useMemo<AuthContextValue>(
    () => ({
      authUser,
      isAuthenticated,
      isAuthBootstrapPending,
      isAuthActionPending,
      authError,
      setAuthError,
      login,
      logout,
      refreshBalance,
      loginWithLocalBypass,
      isLocalBypassPending,
      localBypassError,
    }),
    [
      authUser,
      isAuthenticated,
      isAuthBootstrapPending,
      isAuthActionPending,
      authError,
      setAuthError,
      login,
      logout,
      refreshBalance,
      loginWithLocalBypass,
      isLocalBypassPending,
      localBypassError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
