import { useAppSelector } from '../../store/hooks'
import { selectAuthStatus } from '../../store/slices/authSlice'
import { WorkspaceLayout } from '../WorkspaceLayout'
import { AuthBootstrapScreen } from './AuthBootstrapScreen'
import { LandingRoute } from './LandingRoute'

// A06 — the auth-aware root, made explicit. The three-state auth status
// drives which surface `/` resolves to; nothing is inferred from mount order.
//
//   unknown          → neutral bootstrap state (no wrong-surface flash)
//   unauthenticated  → public landing
//   authenticated    → the existing workspace, untouched
export const RootRoute = () => {
  const authStatus = useAppSelector(selectAuthStatus)

  if (authStatus === 'unknown') {
    return <AuthBootstrapScreen />
  }

  if (authStatus === 'unauthenticated') {
    return <LandingRoute />
  }

  return <WorkspaceLayout />
}
