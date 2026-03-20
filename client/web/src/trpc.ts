import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import { QueryClient } from '@tanstack/react-query'

import type { AppRouter } from '@branching/shared'

export const trpc = createTRPCReact<AppRouter>()

export const queryClient = new QueryClient()

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...(options ?? {}),
          credentials: 'include',
        })
      },
    }),
  ],
})
