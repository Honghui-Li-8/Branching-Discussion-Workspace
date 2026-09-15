import { useAppSelector } from '../../store/hooks'
import { selectAuthStatus } from '../../store/slices/authSlice'
import { Link } from '../ui/link'
import { Cluster, Container, Stack } from '../ui/layout'
import { PATHS } from '../../routePaths'

// A06 — friendly not-found with auth-aware recovery. Replaces the silent
// `<Navigate to="/">` so an unknown URL is never a dead end and never a
// surprise redirect. Copy follows the Figma "404 — Not Found" final.
export const NotFoundRoute = () => {
  const authStatus = useAppSelector(selectAuthStatus)

  return (
    <Container width="narrow">
      <Stack gap="4" align="center" className="py-16 text-center">
        <p className="m-0 text-display font-semibold text-accent-default" aria-hidden="true">
          404
        </p>
        <h1 className="m-0 text-title font-semibold text-text-default">Page not found</h1>
        <p className="m-0 text-body text-text-secondary">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved. Check the URL,
          or head back.
        </p>
        <Cluster as="nav" aria-label="Recovery" gap="4" justify="center">
          {authStatus === 'authenticated' ? (
            <Link to={PATHS.root}>Open workspace</Link>
          ) : (
            <Link to={PATHS.root}>Go to home</Link>
          )}
          {authStatus === 'unauthenticated' ? <Link to={PATHS.login}>Sign in</Link> : null}
        </Cluster>
      </Stack>
    </Container>
  )
}
