import { useState } from 'react'
import GoogleIcon from '@mui/icons-material/Google'
import { useAuth } from './useAuth'

export const LoginPage = () => {
  const { authError, login } = useAuth()
  const [isLoginPending, setIsLoginPending] = useState(false)

  const handleLogin = async () => {
    setIsLoginPending(true)
    try {
      await login()
    } catch {
      // AuthProvider has already surfaced the user-visible error.
    } finally {
      setIsLoginPending(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(165deg,#e9f6ff_0%,#f3fbff_55%,#fffdf5_100%)] px-5 py-8">
      <section className="flex w-full max-w-[560px] flex-col items-center text-center">
        <p className="m-0 text-xs uppercase tracking-[0.14em] text-[#4b7f99]">
          Branching Decision Workspace
        </p>
        <h1 className="my-[14px] text-[clamp(30px,5vw,48px)] leading-[1.12] text-[#12384c]">
          Sign in to continue
        </h1>
        <p className="m-0 max-w-[520px] text-base leading-7 text-[#3f6c81]">
          Use your Google account to open your workspaces and keep your discussion tree
          history in one place.
        </p>

        <button
          type="button"
          onClick={() => {
            void handleLogin()
          }}
          disabled={isLoginPending}
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-[#93bed4] bg-white px-5 text-sm font-semibold text-[#12384c] shadow-sm transition hover:border-[#5d9dbc] hover:bg-[#f7fcff] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoginPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#8fbad1] border-t-[#12384c]" />
          ) : (
            <GoogleIcon fontSize="small" aria-hidden="true" />
          )}
          <span>{isLoginPending ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        {authError ? (
          <p className="mt-4 max-w-[440px] text-sm leading-6 text-[#9a3f3f]" role="alert">
            {authError}
          </p>
        ) : null}
      </section>
    </main>
  )
}
