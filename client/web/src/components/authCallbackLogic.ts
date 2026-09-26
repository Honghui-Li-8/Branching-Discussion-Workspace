import type { AuthUser } from '../store/slices/authSlice'
import { PATHS } from '../routePaths'

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

export type NavigateFn = (path: string, opts?: { replace?: boolean }) => void

/**
 * Requested-destination preservation (A10, round 2 Q3). The page a sign-in
 * was started from is remembered in session storage — it survives the OAuth
 * round-trip in the same tab and needs no change to the provider's redirect
 * allow-list — and consumed exactly once by whichever path completes the
 * sign-in: the callback or the local bypass.
 */
export const DESTINATION_STORAGE_KEY = 'trellis.requestedDestination'

/**
 * Pages worth returning to after sign-in: the real routes a visitor can read
 * before signing in. The root is the default anyway; the sign-in flow's own
 * pages would loop; and an unknown path is the not-found page, whose shell
 * still offers Sign in (PR #39 review) — returning there would land a
 * signed-in user on a 404 instead of the workspace.
 */
const RETURNABLE_PATHS: ReadonlySet<string> = new Set([PATHS.privacy, PATHS.terms])

/**
 * Only a same-origin relative path to a returnable page is honoured, with its
 * query and hash. Anything else — absolute, protocol-relative, the flow's own
 * pages, an unknown page, or nothing — falls back to the authenticated root,
 * so a remembered value can never redirect off-site, into a sign-in loop, or
 * onto a dead end.
 */
export const resolvePostLoginDestination = (candidate: string | null | undefined): string => {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return PATHS.root
  }
  const pathOnly = candidate.split(/[?#]/)[0]
  return RETURNABLE_PATHS.has(pathOnly) ? candidate : PATHS.root
}

/** The sign-in flow's own pages: starting sign-in from one must not overwrite the saved page. */
const AUTH_FLOW_PATHS: ReadonlySet<string> = new Set([PATHS.login, PATHS.authCallback])

export const rememberRequestedDestination = (path: string): void => {
  // The public shell's Sign in CTA still renders on /login; clicking it there
  // would replace the page the visitor came from with one the resolver rejects.
  if (AUTH_FLOW_PATHS.has(path.split(/[?#]/)[0])) return
  try {
    window.sessionStorage.setItem(DESTINATION_STORAGE_KEY, path)
  } catch {
    // Storage can be unavailable (private mode, blocked); the fallback is the root.
  }
}

/** Reads the remembered destination without clearing it. */
export const peekRequestedDestination = (): string | null => {
  try {
    return window.sessionStorage.getItem(DESTINATION_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Clears the remembered destination once a sign-in has succeeded. */
export const clearRequestedDestination = (): void => {
  try {
    window.sessionStorage.removeItem(DESTINATION_STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** Reads and clears the remembered destination, so it is used at most once. */
export const takeRequestedDestination = (): string | null => {
  const value = peekRequestedDestination()
  clearRequestedDestination()
  return value
}

/**
 * The single post-login navigation seam (A06). Every successful sign-in —
 * the OAuth callback and the local dev bypass — lands through here, with the
 * destination the sign-in was started from (A10), resolved by the rule above.
 */
export const navigateAfterLogin = (navigate: NavigateFn, destination?: string | null): void => {
  navigate(resolvePostLoginDestination(destination), { replace: true })
}

/**
 * Where a cancelled or failed sign-in lands: the sign-in page, so the error
 * and the retry action share one screen (owner decision 2026-09-06,
 * superseding the original failure → public-root flow).
 */
export const navigateAfterLoginFailure = (navigate: NavigateFn): void => {
  navigate(PATHS.login, { replace: true })
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
  navigate: NavigateFn
  /** The remembered pre-sign-in page, if any; resolved by `navigateAfterLogin`. */
  destination?: string | null
  /**
   * Consumes the remembered page. Called on success only, so a failed or
   * cancelled exchange keeps it for the retry from the sign-in page.
   */
  clearDestination?: () => void
}

export const runAuthExchange = async ({
  getSession,
  postLogin,
  dispatchAuthUser,
  setAuthError,
  navigate,
  destination,
  clearDestination,
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
    clearDestination?.()
    navigateAfterLogin(navigate, destination)
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'Supabase is not configured.'
        ? 'Sign-in is not configured yet.'
        : error instanceof Error
          ? error.message
          : 'Sign-in failed. Please try again.'
    setAuthError(message)
    navigateAfterLoginFailure(navigate)
  }
}
