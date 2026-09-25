import { useAuth } from './useAuth'

const TOKENS_PER_TURN_ESTIMATE = 1333

/**
 * Quiet usage context in the account row (A10). The zero state is explicit —
 * a send that will fail should never be a surprise — and it is a status, not
 * an alert: nothing has gone wrong yet.
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
      <p role="status" className="mt-2 mb-0 text-caption font-medium text-warning-hover">
        No credit left — sending will fail.
      </p>
    )
  }

  const turnsRemaining = Math.floor(authUser.creditBalance / TOKENS_PER_TURN_ESTIMATE)

  if (turnsRemaining < 1) {
    return <p className="mt-2 mb-0 text-caption text-text-muted">Less than one turn remaining</p>
  }

  return <p className="mt-2 mb-0 text-caption text-text-muted">~{turnsRemaining} turns remaining</p>
}
