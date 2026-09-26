import type { MouseEvent, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Link } from './ui/link'
import { PATHS } from '../routePaths'
import { rememberRequestedDestination } from './authCallbackLogic'

type SignInLinkProps = {
  children: ReactNode
  className?: string
  underline?: 'always' | 'hover'
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * The way into sign-in from a page worth returning to (A10). Remembers the
 * current page before navigating to the sign-in route, so the callback or the
 * local bypass can bring the user back. The not-found page deliberately does
 * not use it: there is nothing there to return to.
 */
export const SignInLink = ({ children, onClick, ...rest }: SignInLinkProps) => {
  const location = useLocation()
  return (
    <Link
      to={PATHS.login}
      {...rest}
      onClick={(event) => {
        rememberRequestedDestination(location.pathname + location.search + location.hash)
        onClick?.(event)
      }}
    >
      {children}
    </Link>
  )
}
