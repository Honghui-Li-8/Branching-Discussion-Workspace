import { useAppSelector } from '../../store/hooks'
import { selectAuthStatus } from '../../store/slices/authSlice'
import { WorkspaceLayout } from '../WorkspaceLayout'
import { AuthBootstrapScreen } from './AuthBootstrapScreen'
import { LandingRoute } from './LandingRoute'
import { PublicShell } from './PublicShell'

// A06 — the auth-aware root, made explicit. The three-state auth status
// drives which surface `/` resolves to; nothing is inferred from mount order.
//
//   unknown          → neutral bootstrap state inside the shell (no flash)
//   unauthenticated  → public landing inside the shell
//   authenticated    → the existing workspace, untouched and outside the shell
export const RootRoute = () => {
  const authStatus = useAppSelector(selectAuthStatus)

  if (authStatus === 'unknown') {
    return (
      <PublicShell>
        <AuthBootstrapScreen />
      </PublicShell>
    )
  }

  if (authStatus === 'unauthenticated') {
    return (
      <PublicShell>
        <LandingRoute />
      </PublicShell>
    )
  }

  return <WorkspaceLayout />
}
