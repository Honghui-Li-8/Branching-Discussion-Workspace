import { useId, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'
import { Link } from './ui/link'
import { OVERFLOW_ICONS } from '../lib/icons'
import { LEGAL_PAGES } from '../routePaths'

type AccountMenuProps = {
  /** `row` is the expanded footer (avatar, name, detail line); `avatar` is the collapsed strip. */
  variant: 'row' | 'avatar'
  /** The row's second line, e.g. the credit balance. Rendered outside the menu button. */
  detail?: ReactNode
}

/**
 * The account menu (A10): who is signed in, the legal pages, and logout, behind
 * the avatar. Owner decision 2026-09-22: Privacy and Terms live here, not as
 * standalone links under the account row. Both sidebar states render it, so
 * logout and the legal pages stay reachable while collapsed.
 *
 * The expanded row (owner pick R2, 2026-09-25) reads as one unit: avatar, name
 * over a detail line, and an overflow icon like the workspace rows. The menu
 * button is laid over the whole row rather than wrapping it, so a status in the
 * detail line is not swallowed by the button's presentational children.
 */
export const AccountMenu = ({ variant, detail }: AccountMenuProps) => {
  const { authUser, authError, isAuthenticated, isAuthBootstrapPending, isAuthActionPending, login, logout } =
    useAuth()

  const currentUserName = isAuthBootstrapPending ? '…' : (authUser?.displayName ?? 'Guest')
  const avatarInitial = currentUserName.trim().slice(0, 1).toUpperCase() || '?'
  const isBusy = isAuthActionPending || isAuthBootstrapPending
  const OverflowIcon = OVERFLOW_ICONS.horizontal
  const errorId = useId()
  const logoutError = authError && !isAuthBootstrapPending ? authError : null

  const avatar = (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-caption font-semibold text-accent-strong"
      aria-hidden="true"
    >
      {avatarInitial}
    </span>
  )

  const content = (
    <DropdownMenuContent align={variant === 'row' ? 'start' : 'end'} side="top" className="w-56">
      <div className="px-2 py-1.5">
        <p className="m-0 truncate text-label font-medium text-text-default">{currentUserName}</p>
        {authUser?.email ? <p className="m-0 truncate text-caption text-text-muted">{authUser.email}</p> : null}
      </div>
      <DropdownMenuSeparator />
      {LEGAL_PAGES.map((page) => (
        <DropdownMenuItem key={page.path} asChild>
          <Link to={page.path} className="text-text-default no-underline hover:text-text-default">
            {page.label}
          </Link>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={isBusy}
        aria-describedby={logoutError ? errorId : undefined}
        onSelect={(event) => {
          // Stay open until the request lands: success unmounts the shell,
          // and a failure is reported here, beside the action that retries it.
          event.preventDefault()
          if (isAuthenticated) void logout()
          else void login()
        }}
      >
        {isAuthActionPending ? 'Working…' : isAuthenticated ? 'Logout' : 'Login'}
      </DropdownMenuItem>
      {/* A failed sign-out keeps the menu open, so the message is shown here,
          beside the action that retries it, and describes that item. A menu may
          own only menu items, so this is plain text: the announcement comes from
          the sidebar's live region (AppSidebar), which stays exposed while the
          menu hides the rest of the page. */}
      {logoutError ? (
        <p id={errorId} className="m-0 px-2 pt-1 pb-1.5 text-caption text-error-default">
          {logoutError}
        </p>
      ) : null}
    </DropdownMenuContent>
  )

  if (variant === 'avatar') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Account menu"
            title={currentUserName}
            disabled={isAuthBootstrapPending}
            className="px-1.5"
          >
            {avatar}
          </Button>
        </DropdownMenuTrigger>
        {content}
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <div className="relative flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-bg-subtle has-[button:disabled]:hover:bg-transparent">
        {avatar}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-label leading-tight font-medium text-text-default">
            {isAuthBootstrapPending ? 'Checking…' : currentUserName}
          </span>
          {detail}
        </div>
        <OverflowIcon className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            // WCAG 2.5.3: the row shows the user's name, so the name leads.
            aria-label={isAuthBootstrapPending ? 'Account menu' : `${currentUserName}, account menu`}
            title={currentUserName}
            disabled={isAuthBootstrapPending}
            className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default disabled:cursor-default"
          />
        </DropdownMenuTrigger>
      </div>
      {content}
    </DropdownMenu>
  )
}
