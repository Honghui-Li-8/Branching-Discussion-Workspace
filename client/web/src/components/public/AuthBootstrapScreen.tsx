import { Container, Stack } from '../ui/layout'

// A06: the neutral state shown while `GET /auth/me` resolves — neither the
// landing nor the workspace may flash before sign-in status is known. Renders
// inside the public shell, so the page is branded by the header. The text is
// the state (no motion-only indicator, A-T3e §7); the h1 keeps the one-h1-per-
// page rule (§4) — the live region announces the same text.
export const AuthBootstrapScreen = () => {
  return (
    <Container>
      <Stack gap="2" align="center" className="py-16 text-center">
        <h1 className="m-0 text-title font-medium text-text-default">Checking sign-in</h1>
        <p role="status" aria-live="polite" className="m-0 text-label text-text-muted">
          One moment while we confirm your session.
        </p>
      </Stack>
    </Container>
  )
}
