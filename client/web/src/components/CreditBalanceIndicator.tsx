import { useAuth } from './useAuth'

const TOKENS_PER_TURN_ESTIMATE = 1333

export const CreditBalanceIndicator = () => {
  const { authUser, isAuthenticated } = useAuth()

  if (!isAuthenticated || authUser === null) {
    return null
  }

  const turnsRemaining = Math.floor(authUser.creditBalance / TOKENS_PER_TURN_ESTIMATE)

  return (
    <p className="m-0 text-[11px] text-[#40718a]">
      ~{turnsRemaining} turns remaining
    </p>
  )
}
