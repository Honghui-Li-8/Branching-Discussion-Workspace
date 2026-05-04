import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAppDispatch } from '../store/hooks'
import { setAuthenticatedUser, type AuthUser } from '../store/slices/authSlice'
import { useAuth } from './useAuth'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

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
    displayNameIsValid &&
    typeof candidate.creditBalance === 'number'
  )
}

export const AuthCallback = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { setAuthError } = useAuth()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) {
      return
    }
    hasRunRef.current = true

    const exchangeSession = async (): Promise<void> => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session?.access_token) {
          throw new Error('Sign-in failed. Please try again.')
        }

        const response = await fetch(`${apiBaseUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            token: session.access_token,
            provider: 'supabase',
          }),
        })

        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: unknown
          user?: unknown
          error?: unknown
        }

        if (!response.ok) {
          const serverError = typeof payload.error === 'string' ? payload.error : null
          throw new Error(serverError ?? 'Sign-in failed. Please try again.')
        }

        if (payload.authenticated !== true || !isAuthUser(payload.user)) {
          throw new Error('Unexpected sign-in response.')
        }

        dispatch(setAuthenticatedUser(payload.user))
        setAuthError(null)
        navigate('/', { replace: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign-in failed. Please try again.'
        setAuthError(message)
        navigate('/', { replace: true })
      }
    }

    void exchangeSession()
  }, [dispatch, navigate, setAuthError])

  return (
    <div className="grid min-h-screen place-items-center bg-[#f3fbff] px-4 text-sm text-[#456579]">
      Completing sign-in...
    </div>
  )
}
