import type { AuthUser } from '../store/slices/authSlice'
import { isAuthUser } from './authCallbackLogic'

export type LocalBypassLoginResponse = {
  ok: boolean
  payload: { authenticated?: unknown; user?: unknown; error?: unknown }
}

export interface LocalBypassDeps {
  postLogin: () => Promise<LocalBypassLoginResponse>
  dispatchAuthUser: (user: AuthUser) => void
  setError: (message: string | null) => void
}

const DEFAULT_FAILURE_MESSAGE = 'Local developer sign-in failed.'

// Unlike runAuthExchange, this rethrows: LoginPage awaits the call and relies on the rejection to
// know the action finished unsuccessfully, while the message is surfaced through setError.
export const runLocalBypassLogin = async ({
  postLogin,
  dispatchAuthUser,
  setError,
}: LocalBypassDeps): Promise<void> => {
  try {
    const { ok, payload } = await postLogin()

    if (!ok || payload.authenticated !== true || !isAuthUser(payload.user)) {
      const serverError = typeof payload.error === 'string' ? payload.error : null
      throw new Error(serverError ?? DEFAULT_FAILURE_MESSAGE)
    }

    dispatchAuthUser(payload.user)
    setError(null)
  } catch (error) {
    setError(error instanceof Error ? error.message : DEFAULT_FAILURE_MESSAGE)
    throw error
  }
}
