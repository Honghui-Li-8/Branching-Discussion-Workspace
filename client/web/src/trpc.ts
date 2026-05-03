import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import type { AppRouter } from '@branching/shared'
import { store } from './store'
import {
  clearClientSessionState,
  isUnauthorizedTrpcError,
  shouldRetryQuery,
} from './trpcAuthHandling'

export const trpc = createTRPCReact<AppRouter>()

const handleGlobalTrpcError = (error: unknown): void => {
  if (!isUnauthorizedTrpcError(error)) {
    return
  }

  clearClientSessionState({
    dispatch: store.dispatch,
    getAuthStatus: () => store.getState().auth.status,
    queryClient,
  })
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalTrpcError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalTrpcError,
  }),
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
  },
})

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...(options ?? {}),
          credentials: 'include',
        }).then((response) => {
          if (response.status === 429) {
            throw new Error('RATE_LIMITED')
          }
          return response
        })
      },
    }),
  ],
})
