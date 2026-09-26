import type { QueryClient } from '@tanstack/react-query'
import { clearAuthenticatedUser } from './store/slices/authSlice'
import {
  setActiveWorkspaceId,
  setWorkspaces,
  setWorkspacesLoading,
} from './store/slices/appShellSlice'

type TrpcErrorShape = {
  data?: {
    code?: string
  }
}

type SessionStateDeps = {
  dispatch: (action: unknown) => void
  getAuthStatus: () => 'unknown' | 'authenticated' | 'unauthenticated'
  queryClient: QueryClient
}

export const isUnauthorizedTrpcError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const trpcError = error as TrpcErrorShape
  return trpcError.data?.code === 'UNAUTHORIZED'
}

export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (isUnauthorizedTrpcError(error)) {
    return false
  }
  return failureCount < 3
}

export const clearClientSessionState = ({
  dispatch,
  getAuthStatus,
  queryClient,
}: SessionStateDeps): void => {
  if (getAuthStatus() === 'unauthenticated') {
    return
  }

  // Only a server-side UNAUTHORIZED reaches here, so the session ended on its
  // own: the public shell explains it rather than landing the user silently.
  dispatch(clearAuthenticatedUser({ reason: 'session-expired' }))
  dispatch(setWorkspacesLoading(false))
  dispatch(setWorkspaces([]))
  dispatch(setActiveWorkspaceId(null))
  queryClient.clear()
}
