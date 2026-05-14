import type { AuthUser } from '../store/slices/authSlice'

export const isAuthUser = (value: unknown): value is AuthUser => {
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

export interface AuthExchangeDeps {
  getSession: () => Promise<{
    data: { session: { access_token: string } | null }
    error: unknown
  }>
  postLogin: (token: string) => Promise<{
    ok: boolean
    payload: { authenticated?: unknown; user?: unknown; error?: unknown }
  }>
  dispatchAuthUser: (user: AuthUser) => void
  setAuthError: (message: string | null) => void
  navigate: (path: string, opts?: { replace?: boolean }) => void
}

export const runAuthExchange = async ({
  getSession,
  postLogin,
  dispatchAuthUser,
  setAuthError,
  navigate,
}: AuthExchangeDeps): Promise<void> => {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await getSession()

    if (sessionError || !session?.access_token) {
      throw new Error('Sign-in failed. Please try again.')
    }

    const { ok, payload } = await postLogin(session.access_token)

    if (!ok) {
      const serverError = typeof payload.error === 'string' ? payload.error : null
      throw new Error(serverError ?? 'Sign-in failed. Please try again.')
    }

    if (payload.authenticated !== true || !isAuthUser(payload.user)) {
      throw new Error('Unexpected sign-in response.')
    }

    dispatchAuthUser(payload.user)
    setAuthError(null)
    navigate('/', { replace: true })
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'Supabase is not configured.'
        ? 'Sign-in is not configured yet.'
        : error instanceof Error
          ? error.message
          : 'Sign-in failed. Please try again.'
    setAuthError(message)
    navigate('/', { replace: true })
  }
}
