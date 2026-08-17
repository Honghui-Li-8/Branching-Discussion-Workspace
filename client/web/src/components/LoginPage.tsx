import { useEffect, useState } from 'react'
import GoogleIcon from '@mui/icons-material/Google'
import { describeLocalAuthBypassMisconfiguration, isLocalAuthBypassAvailable } from '../devFlags'
import { useAuth } from './useAuth'

const localAuthBypassGateInput = {
  isViteDev: import.meta.env.DEV,
  bypassEnabledFlag: import.meta.env.VITE_ENABLE_LOCAL_AUTH_BYPASS,
  hostname: window.location.hostname,
  devToken: import.meta.env.VITE_DEV_AUTH_TOKEN,
}
const isBypassAvailable = isLocalAuthBypassAvailable(localAuthBypassGateInput)

export const LoginPage = () => {
  const { authError, login, loginWithLocalBypass, isLocalBypassPending, localBypassError } = useAuth()
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

  const handleLocalBypassLogin = async () => {
    try {
      await loginWithLocalBypass()
    } catch {
      // AuthProvider has already surfaced localBypassError.
    }
  }

  useEffect(() => {
    if (isBypassAvailable) {
      return
    }
    const explanation = describeLocalAuthBypassMisconfiguration(localAuthBypassGateInput)
    if (explanation) {
      console.info(explanation)
    }
  }, [])

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-5 py-8">
      <section className="flex w-full max-w-[560px] flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Trellis
        </p>
        <h1 className="my-[14px] text-[clamp(30px,5vw,46px)] font-semibold leading-[1.08] text-slate-950">
          Sign in to continue
        </h1>
        <p className="m-0 max-w-[520px] text-base leading-7 text-slate-600">
          Use your Google account to open your workspaces and keep your discussion tree
          history in one place.
        </p>

        <button
          type="button"
          onClick={() => {
            void handleLogin()
          }}
          disabled={isLoginPending}
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoginPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <GoogleIcon fontSize="small" aria-hidden="true" />
          )}
          <span>{isLoginPending ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        {authError ? (
          <p className="mt-4 max-w-[440px] text-sm leading-6 text-red-700" role="alert">
            {authError}
          </p>
        ) : null}

        {/*
          The literal `import.meta.env.DEV` is load-bearing, not redundant with isBypassAvailable.
          Vite statically replaces it with `false` in a production build, which is what lets the
          bundler drop this whole block including the button label. isBypassAvailable is a runtime
          value the bundler cannot fold, so removing the literal would ship the label. See A00a
          DoD #8.
        */}
        {import.meta.env.DEV && isBypassAvailable ? (
          <>
            <button
              type="button"
              onClick={() => {
                void handleLocalBypassLogin()
              }}
              disabled={isLocalBypassPending}
              className="mt-4 inline-flex min-h-12 items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLocalBypassPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              ) : null}
              <span>{isLocalBypassPending ? 'Signing in...' : 'Continue as local developer'}</span>
            </button>
            {localBypassError ? (
              <p className="mt-4 max-w-[440px] text-sm leading-6 text-red-700" role="alert">
                {localBypassError}
              </p>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  )
}
