import { LoginPage } from '../LoginPage'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

// A06 — `/login` as a real, bookmarkable page. Renders the existing login
// surface (dev bypass included) regardless of auth state; Commit 4 wraps it in
// the shared public shell.
export const LoginRoute = () => {
  useDocumentTitle('Sign in')
  return <LoginPage />
}
