import { TRPCError } from '@trpc/server'
import type { AppRouterContext } from '@branching/shared'
import { getUserById } from '../db/index.js'
import { createLogger } from '../logging/logger.js'
import type { RequireSessionUserId } from './types.js'

type UserHandlers = Pick<AppRouterContext, 'listUsers' | 'getUserById'>

const logger = createLogger('trpc-context')

export const createUserHandlers = ({
  requireSessionUserId,
}: {
  requireSessionUserId: RequireSessionUserId
}): UserHandlers => ({
  listUsers: async () => {
    const currentUserId = requireSessionUserId()
    try {
      const currentUser = await getUserById(currentUserId)
      return currentUser ? [currentUser] : []
    } catch (error) {
      logger.error('[user] list request failed.', {
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[user] list request debug error details.', {
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
  getUserById: async (id) => {
    const currentUserId = requireSessionUserId()
    try {
      if (id !== currentUserId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'User access is forbidden.',
        })
      }

      return await getUserById(id)
    } catch (error) {
      logger.error('[user] get-by-id request failed.', {
        user_id: id,
        author_user_id: currentUserId,
        error,
      })
      logger.debug('[user] get-by-id request debug error details.', {
        user_id: id,
        author_user_id: currentUserId,
        error,
      })
      throw error
    }
  },
})
