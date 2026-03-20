import { useEffect } from 'react'
import { useAppDispatch } from '../store/hooks'
import { setAuthenticatedUser, type AuthUser } from '../store/slices/authSlice'

const attemptedLoginOnceKeys = new Set<string>()

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

export const useAuth = (): void => {
  const dispatch = useAppDispatch()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
  const devToken = import.meta.env.VITE_DEV_AUTH_TOKEN ?? ''

  useEffect(() => {
    if (!devToken) {
      console.warn('VITE_DEV_AUTH_TOKEN is missing. Skipping dev auto-login.')
      return
    }

    const attemptKey = `${apiBaseUrl}:${devToken}`
    if (attemptedLoginOnceKeys.has(attemptKey)) {
      return
    }
    attemptedLoginOnceKeys.add(attemptKey)

    let isCancelled = false

    const login = async (): Promise<void> => {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            token: devToken,
          }),
        })

        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: unknown
          user?: unknown
          error?: unknown
        }

        if (!response.ok) {
          const serverError =
            typeof payload.error === 'string' ? payload.error : 'Unable to authenticate.'
          throw new Error(serverError)
        }

        if (!isCancelled && payload.authenticated === true && isAuthUser(payload.user)) {
          dispatch(setAuthenticatedUser(payload.user))
        }
      } catch (error) {
        console.error('Dev auto-login failed:', error)
      }
    }

    void login()

    return () => {
      isCancelled = true
    }
  }, [apiBaseUrl, devToken, dispatch])
}
