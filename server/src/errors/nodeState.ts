import { TRPCError } from '@trpc/server'

export const createNodeIsMergedError = (): TRPCError =>
  new TRPCError({
    code: 'CONFLICT',
    message: 'NODE_IS_MERGED',
  })
