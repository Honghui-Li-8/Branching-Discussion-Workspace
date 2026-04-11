import { createOrGetConversationPostprocessJobForAuthor as createOrGetConversationPostprocessJobForAuthorRecord } from '../db/index.js'
import { createLogger } from '../logging/logger.js'

const POSTPROCESS_JOB_TYPES = ['summary', 'index'] as const
const logger = createLogger('chat-turn')

export const enqueuePostprocessJobsForTurn = async (
  turnId: string,
  currentUserId: string,
): Promise<void> => {
  for (const jobType of POSTPROCESS_JOB_TYPES) {
    try {
      const result = await createOrGetConversationPostprocessJobForAuthorRecord(
        {
          turnId,
          jobType,
          payload: {},
        },
        currentUserId,
      )
      if (!result) {
        logger.warn('[postprocess] enqueue skipped because turn is not accessible.', {
          turnId,
          jobType,
          currentUserId,
          turn_id: turnId,
          job_type: jobType,
          author_user_id: currentUserId,
        })
      }
    } catch (error) {
      logger.warn('[postprocess] enqueue failed but response path remains successful.', {
        turnId,
        jobType,
        currentUserId,
        turn_id: turnId,
        job_type: jobType,
        author_user_id: currentUserId,
        error,
      })
    }
  }
}
