import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

export const appRouter = t.router({
  health: t.procedure.query(() => ({
    status: 'ok',
    service: 'server',
    uptime: Math.floor(performance.now() / 1000),
  })),
  echo: t.procedure
    .input(z.string())
    .query(({ input }) => ({ message: `Hello, ${input}` })),
})

export type AppRouter = typeof appRouter
