import { Container } from '../ui/layout'

// A06: the neutral state shown while `GET /auth/me` resolves — neither the
// landing nor the workspace may flash before sign-in status is known. Renders
// inside the public shell, so the page is branded by the header; the text is
// the state (no motion-only indicator, A-T3e §7).
export const AuthBootstrapScreen = () => {
  return (
    <Container>
      <p role="status" aria-live="polite" className="py-16 text-center text-label text-text-muted">
        Checking sign-in…
      </p>
    </Container>
  )
}
