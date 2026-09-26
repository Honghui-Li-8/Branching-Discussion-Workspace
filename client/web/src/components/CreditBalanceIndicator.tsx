import { useAuth } from './useAuth'

const TOKENS_PER_TURN_ESTIMATE = 1333

/**
 * Quiet usage context, the second line of the account row (A10; owner pick R2,
 * 2026-09-25). The zero state is explicit — a send that will fail should never
 * be a surprise — and it is a status, not an alert: nothing has gone wrong yet.
 * It renders outside the account-menu button so the status stays announced.
 */
export const CreditBalanceIndicator = () => {
  const { authUser, isAuthenticated } = useAuth()

  if (!isAuthenticated || authUser === null) {
    return null
  }

  // The failure claim follows the server's credit guard (a balance at or
  // below zero), not the turn estimate: a small positive balance still sends.
  if (authUser.creditBalance <= 0) {
    return (
      <p role="status" className="m-0 text-caption leading-tight font-medium text-warning-hover">
        No credit left — sending will fail.
      </p>
    )
  }

  const turnsRemaining = Math.floor(authUser.creditBalance / TOKENS_PER_TURN_ESTIMATE)

  if (turnsRemaining < 1) {
    return <p className="m-0 truncate text-caption leading-tight text-text-muted">Less than one turn remaining</p>
  }

  return <p className="m-0 truncate text-caption leading-tight text-text-muted">~{turnsRemaining} turns remaining</p>
}
