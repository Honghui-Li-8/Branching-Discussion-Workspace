import { QueryClient } from '@tanstack/react-query'
import { store } from './store'
import { setAuthState } from './store/slices/authSlice'
import { setActiveWorkspaceId, setWorkspaces, setWorkspacesLoading } from './store/slices/appShellSlice'
import {
  clearClientSessionState,
  isUnauthorizedTrpcError,
  shouldRetryQuery,
} from './trpcAuthHandling'

describe('trpc client auth handling', () => {
  let localQueryClient: QueryClient

  beforeEach(() => {
    localQueryClient = new QueryClient()
    store.dispatch(setAuthState({ status: 'unauthenticated', user: null }))
    store.dispatch(setWorkspaces([]))
    store.dispatch(setActiveWorkspaceId(null))
    store.dispatch(setWorkspacesLoading(false))
  })

  test('detects unauthorized tRPC errors', () => {
    expect(isUnauthorizedTrpcError({ data: { code: 'UNAUTHORIZED' } })).toBe(true)
    expect(isUnauthorizedTrpcError({ data: { code: 'FORBIDDEN' } })).toBe(false)
    expect(isUnauthorizedTrpcError(new Error('x'))).toBe(false)
    expect(isUnauthorizedTrpcError(null)).toBe(false)
  })

  test('clearClientSessionState clears auth, workspace state, and query cache', () => {
    store.dispatch(
      setAuthState({
        status: 'authenticated',
        user: {
          id: 'u1',
          authUserId: 'auth:u1',
          email: 'u1@example.com',
          displayName: 'User One',
        },
      }),
    )
    store.dispatch(
      setWorkspaces([
        {
          id: 'w1',
          title: 'Workspace One',
          summary: 'Summary',
        },
      ]),
    )
    store.dispatch(setActiveWorkspaceId('w1'))
    store.dispatch(setWorkspacesLoading(true))
    localQueryClient.setQueryData([['workspacesList']], [{ id: 'w1' }])

    clearClientSessionState({
      dispatch: store.dispatch,
      getAuthStatus: () => store.getState().auth.status,
      queryClient: localQueryClient,
    })

    const state = store.getState()
    expect(state.auth.status).toBe('unauthenticated')
    expect(state.auth.user).toBeNull()
    expect(state.appShell.workspaces).toEqual([])
    expect(state.appShell.activeWorkspaceId).toBeNull()
    expect(state.appShell.isWorkspacesLoading).toBe(false)
    expect(localQueryClient.getQueryData([['workspacesList']])).toBeUndefined()
  })

  test('query retry policy disables retries for UNAUTHORIZED', () => {
    expect(shouldRetryQuery(0, { data: { code: 'UNAUTHORIZED' } })).toBe(false)
    expect(shouldRetryQuery(0, { data: { code: 'INTERNAL_SERVER_ERROR' } })).toBe(true)
    expect(shouldRetryQuery(3, { data: { code: 'INTERNAL_SERVER_ERROR' } })).toBe(false)
  })
})
