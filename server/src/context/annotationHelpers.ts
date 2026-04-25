import type { MessageRecord } from '../db/models/message.js'
import { getBranchEventMetadataFromRecord } from '../db/queries/message.js'

export const getFollowupUserMessageForTurn = (turnMessages: MessageRecord[]) =>
  turnMessages.find(
    (message) => message.role === 'user' && getBranchEventMetadataFromRecord(message) === null,
  ) ?? null
