import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { dismissSignedOutReason, selectSignedOutReason } from '../../store/slices/authSlice'
import { ICONS } from '../../lib/icons'
import { SignInLink } from '../SignInLink'
import { Container } from '../ui/layout'

/**
 * Explains a sign-out the user did not ask for (A10 error handling: "session
 * expires → clear protected data and return to public entry with an
 * explanation"). The data is already cleared by the time this renders; this
 * says why the workspace went away and how to get back to it.
 */
export const SessionExpiredNotice = () => {
  const dispatch = useAppDispatch()
  const reason = useAppSelector(selectSignedOutReason)
  const CloseIcon = ICONS.close

  if (reason !== 'session-expired') return null

  return (
    <div className="border-b border-border-default bg-warning-tint text-text-default">
      <Container>
        <div className="flex items-start gap-3 py-3">
          <p role="status" className="m-0 flex-1 text-label">
            Your session expired, so you&rsquo;ve been signed out.{' '}
            <SignInLink underline="always">Sign in</SignInLink> to pick up where you left off.
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dispatch(dismissSignedOutReason())}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-bg-subtle hover:text-text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default"
          >
            <CloseIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </Container>
    </div>
  )
}
