import { TRPCError, initTRPC } from '@trpc/server'
import type { AppRouterContext } from './context.js'

export const t = initTRPC.context<AppRouterContext>().create()

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.sessionUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    })
  }

  return next()
})
