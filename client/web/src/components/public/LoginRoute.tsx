import { LoginPage } from '../LoginPage'

// A06 — `/login` as a real, bookmarkable page. Renders the existing login
// surface (dev bypass included) regardless of auth state; Commit 4 wraps it in
// the shared public shell.
export const LoginRoute = () => {
  return <LoginPage />
}
