import { useEffect, useMemo, useState } from 'react'
import GoogleIcon from '@mui/icons-material/Google'
import {
  describeLocalAuthBypassMisconfiguration,
  isLocalAuthBypassAvailable,
  type LocalAuthBypassGateInput,
} from '../devFlags'
import { useAuth } from './useAuth'
import { devAuthToken, isDev, localAuthBypassFlag } from '../lib/env'

// Read at call time, not on import: touching window at module scope makes this module impossible
// to import outside a DOM.
//
// Every VITE_* value arrives via lib/env, which gates its reads on Vite's DEV literal so the
// configured token never reaches a production bundle (A00a DoD #8). Vite replaces DEV with
// `false`, letting the minifier fold each gated read to undefined.
const readLocalAuthBypassGateInput = (): LocalAuthBypassGateInput => ({
  isViteDev: isDev,
  bypassEnabledFlag: localAuthBypassFlag,
  hostname: window.location.hostname,
  devToken: devAuthToken,
})

export const LoginPage = () => {
  const { authError, login, loginWithLocalBypass, isLocalBypassPending, localBypassError } = useAuth()
  const [isLoginPending, setIsLoginPending] = useState(false)
  const localAuthBypassGateInput = useMemo(readLocalAuthBypassGateInput, [])
  const isBypassAvailable = isLocalAuthBypassAvailable(localAuthBypassGateInput)

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
    // The DEV literal lets Vite tree-shake the misconfiguration helper and its variable-name
    // strings out of production builds, alongside the button label below.
    if (!isDev || isBypassAvailable) {
      return
    }
    const explanation = describeLocalAuthBypassMisconfiguration(localAuthBypassGateInput)
    if (explanation) {
      console.info(explanation)
    }
  }, [isBypassAvailable, localAuthBypassGateInput])

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
          `isDev` is load-bearing, not redundant with isBypassAvailable. It is lib/env's alias of
          Vite's DEV literal, which the bundler folds to `false` in a production build — that is
          what lets it drop this whole block including the button label. isBypassAvailable is a
          runtime value the bundler cannot fold, so removing the gate would ship the label. See
          A00a DoD #8; the bundle grep in A06 Commit 3 verified the fold survives the indirection.
        */}
        {isDev && isBypassAvailable ? (
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
