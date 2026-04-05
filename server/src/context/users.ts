import { TRPCError } from '@trpc/server'
import type { AppRouterContext } from '@branching/shared'
import { getUserById } from '../db/index.js'
import type { RequireSessionUserId } from './types.js'

type UserHandlers = Pick<AppRouterContext, 'listUsers' | 'getUserById'>

export const createUserHandlers = ({
  requireSessionUserId,
}: {
  requireSessionUserId: RequireSessionUserId
}): UserHandlers => ({
  listUsers: async () => {
    const currentUserId = requireSessionUserId()
    const currentUser = await getUserById(currentUserId)
    return currentUser ? [currentUser] : []
  },
  getUserById: async (id) => {
    const currentUserId = requireSessionUserId()
    if (id !== currentUserId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'User access is forbidden.',
      })
    }

    return getUserById(id)
  },
})
