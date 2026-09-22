import { useAppSelector } from '../../store/hooks'
import { selectAuthStatus } from '../../store/slices/authSlice'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
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

// The signed-in workspace owns the bare product title (A08). Set here, not in
// WorkspaceLayout, which A06 keeps as a pure move (A10 owns its restyle).
const WorkspaceRoute = () => {
  useDocumentTitle()
  return <WorkspaceLayout />
}

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

  return <WorkspaceRoute />
}
