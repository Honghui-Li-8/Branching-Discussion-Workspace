/* eslint-disable react-refresh/only-export-components -- test harness: exports fixtures and a
   render helper beside one probe component, and is never hot-reloaded. */
import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { httpBatchLink } from '@trpc/client'

import { trpc } from '../trpc'
import { AuthProvider } from '../components/AuthProvider'
import { WorkspaceSync } from '../components/WorkspaceSync'
import { createAppStore, type RootState } from '../store'
import type { AuthStatus, AuthUser } from '../store/slices/authSlice'

// A06 — the first full-app render harness. Mirrors main.tsx's provider stack
// (router → redux → tRPC → react-query → auth → workspace sync) around an
// isolated store and query client per render, so route-level tests can assert
// "given this URL and this auth state, this surface renders" by role and
// landmark, never by internals.

export const TEST_USER: AuthUser = {
  id: 'user-1',
  authUserId: 'auth-user-1',
  email: 'reviewer@example.com',
  displayName: 'Reviewer',
  creditBalance: 100,
}

/** A fetch that never settles: bootstrap stays pending, queries stay loading. */
export const pendingFetch: typeof fetch = () => new Promise<Response>(() => {})

/** A fetch that fails outright: the "API is down" case. */
export const failingFetch: typeof fetch = () => Promise.reject(new TypeError('Failed to fetch'))

/** Reports the router's current location so tests can assert on navigation. */
export const LocationProbe = () => {
  const location = useLocation()
  // A span, not <output>: <output> carries an implicit `status` role that
  // would collide with the surfaces under test.
  return <span data-testid="location">{location.pathname + location.hash}</span>
}

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  /** Starting URL. */
  route?: string
  /** Preloaded auth status. `unknown` lets AuthProvider run its bootstrap fetch. */
  authStatus?: AuthStatus
  user?: AuthUser | null
  /** Global fetch for the render's lifetime (auth calls and tRPC batches both use it). */
  fetchImpl?: typeof fetch
}

export const renderWithProviders = (
  ui: ReactElement,
  {
    route = '/',
    authStatus = 'unauthenticated',
    user = authStatus === 'authenticated' ? TEST_USER : null,
    fetchImpl = pendingFetch,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) => {
  globalThis.fetch = fetchImpl

  const preloadedState: Partial<RootState> = { auth: { status: authStatus, user } }
  const store = createAppStore(preloadedState)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: 'http://localhost:3001/trpc', fetch: (url, init) => fetchImpl(url, init) })],
  })

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Provider store={store}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <WorkspaceSync>
                {children}
                <LocationProbe />
              </WorkspaceSync>
            </AuthProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </Provider>
    </MemoryRouter>
  )

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}
