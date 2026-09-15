import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GoogleIcon from '@mui/icons-material/Google'
import {
  describeLocalAuthBypassMisconfiguration,
  isLocalAuthBypassAvailable,
  type LocalAuthBypassGateInput,
} from '../devFlags'
import { useAuth } from './useAuth'
import { devAuthToken, isDev, localAuthBypassFlag } from '../lib/env'
import { navigateAfterLogin } from './authCallbackLogic'
import { AlertBanner } from './ui/alert-banner'
import { Button } from './ui/button'
import { Container, Stack } from './ui/layout'

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
  const navigate = useNavigate()
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
      // Same seam the OAuth callback uses: the bypass now runs from /login,
      // which renders regardless of auth state, so success must navigate.
      navigateAfterLogin(navigate)
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

  // A06: this surface renders inside the public shell, which owns the page's
  // `main`, header and footer. The card is the page content — and its only h1.
  // Re-tokened in the same pass (ADR-0001 assigns replacing this surface's
  // pinned measures to its own rebuild): role colours, the narrow measure,
  // the ui Button for both actions. Behaviour and the bypass gate are untouched.
  return (
    <Container width="narrow" className="py-12">
      <Stack
        as="section"
        aria-labelledby="login-heading"
        gap="4"
        align="center"
        className="rounded-lg border border-border-default bg-bg-default px-6 py-10 text-center shadow-card"
      >
        <p className="m-0 text-caption font-semibold uppercase tracking-wide text-text-muted">Trellis</p>
        <h1 id="login-heading" className="m-0 text-title font-semibold text-text-default">
          Sign in to continue
        </h1>
        <p className="m-0 text-body text-text-secondary">
          Use your Google account to open your workspaces and keep your discussion tree
          history in one place.
        </p>

        <Button
          type="button"
          size="lg"
          pending={isLoginPending}
          onClick={() => {
            void handleLogin()
          }}
        >
          <GoogleIcon fontSize="small" aria-hidden="true" />
          Sign in with Google
        </Button>

        {/* Assertive by role: an error that blocks the user (A-T3e §6), rendered
            beside the action that retries it — message and retry share one screen. */}
        {authError ? (
          <AlertBanner tone="error" title="Sign-in failed" className="w-full text-left">
            {authError}
          </AlertBanner>
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
            <Button
              type="button"
              variant="secondary"
              size="lg"
              pending={isLocalBypassPending}
              onClick={() => {
                void handleLocalBypassLogin()
              }}
            >
              Continue as local developer
            </Button>
            {localBypassError ? (
              <AlertBanner tone="error" title="Local sign-in failed" className="w-full text-left">
                {localBypassError}
              </AlertBanner>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Container>
  )
}
