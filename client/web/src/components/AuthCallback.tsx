import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabaseClient } from '../lib/supabaseClient'
import { useAppDispatch } from '../store/hooks'
import { setAuthenticatedUser } from '../store/slices/authSlice'
import { useAuth } from './useAuth'
import { runAuthExchange } from './authCallbackLogic'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

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
    <div className="grid min-h-screen place-items-center bg-[#f3fbff] px-4 text-sm text-[#456579]">
      Completing sign-in...
    </div>
  )
}
