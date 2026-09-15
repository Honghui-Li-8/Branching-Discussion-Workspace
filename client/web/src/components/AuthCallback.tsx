import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabaseClient } from '../lib/supabaseClient'
import { useAppDispatch } from '../store/hooks'
import { setAuthenticatedUser } from '../store/slices/authSlice'
import { useAuth } from './useAuth'
import { runAuthExchange } from './authCallbackLogic'
import { apiBaseUrl } from '../lib/env'
import { Container } from './ui/layout'

// A06 — the OAuth return. This surface renders the pending state only; every
// terminal outcome is a navigation (success → authenticated root, cancel or
// failure → /login with the error beside the retry action), decided in
// authCallbackLogic. The text is the state: no motion-only indicator (A-T3e §7).
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

    void runAuthExchange({
      getSession: () => getSupabaseClient().auth.getSession(),
      postLogin: async (token) => {
        const response = await fetch(`${apiBaseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token, provider: 'supabase' }),
        })
        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: unknown
          user?: unknown
          error?: unknown
        }
        return { ok: response.ok, payload }
      },
      dispatchAuthUser: (user) => dispatch(setAuthenticatedUser(user)),
      setAuthError,
      navigate,
    })
  }, [dispatch, navigate, setAuthError])

  return (
    <Container>
      <p role="status" aria-live="polite" className="py-16 text-center text-label text-text-muted">
        Completing sign-in…
      </p>
    </Container>
  )
}
