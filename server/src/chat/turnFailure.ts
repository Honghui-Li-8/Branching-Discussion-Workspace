import { updateConversationTurnForAuthor as updateConversationTurnForAuthorRecord } from '../db/index.js'

const markTurnFailed = async (
  turnId: string,
  currentUserId: string,
  errorMessage: string,
): Promise<void> => {
  await updateConversationTurnForAuthorRecord(
    {
      id: turnId,
      status: 'failed',
      error: errorMessage,
    },
    currentUserId,
  )
}

export type MarkTurnFailedOnce = (errorMessage: string) => Promise<void>

export const createMarkTurnFailedOnce = ({
  turnId,
  currentUserId,
}: {
  turnId: string
  currentUserId: string
}): MarkTurnFailedOnce => {
  let hasMarkedTurnFailed = false

  return async (errorMessage: string): Promise<void> => {
    if (hasMarkedTurnFailed) {
      return
    }
    hasMarkedTurnFailed = true
    await markTurnFailed(turnId, currentUserId, errorMessage)
  }
}
