import { useState } from 'react'
import { useStore } from 'react-redux'
import { nanoid } from '@reduxjs/toolkit'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import type { ExampleWorkspaceKey } from '@branching/shared/router/schemas/core'
import type { RootState } from '../store'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  endCreate,
  selectCreatePendingKey,
  selectCreateRequestId,
  selectWorkspaces,
  selectWorkspacesLoadFailed,
  selectWorkspacesLoading,
  setActiveWorkspaceId,
  setWorkspaces,
  startCreate,
  type CreatePendingKey,
} from '../store/slices/appShellSlice'
import { toWorkspaceNavItems } from './workspaceNavItems'
import { trpc } from '../trpc'
import { useAuth } from './useAuth'
import { isUnauthorizedTrpcError } from '../trpcAuthHandling'

export const EXAMPLE_WORKSPACES: ReadonlyArray<{
  key: ExampleWorkspaceKey
  title: string
  description: string
}> = [
  {
    key: 'project-decision',
    title: 'Project Decision',
    description: 'Should I build this project now?',
  },
  {
    key: 'database-selection',
    title: 'Choose a Database',
    description: 'PostgreSQL vs MongoDB vs DynamoDB for a new service.',
  },
  {
    key: 'project-walkthrough',
    title: 'Project Walkthrough',
    description: 'Seeded architecture walkthrough with turn lifecycle and branch provenance.',
  },
  {
    key: 'project-walkthrough-script',
    title: 'Project Walkthrough Script',
    description: 'Reusable architecture walkthrough script embedded as node conversations.',
  },
]

const CREATE_FAILED = 'Something went wrong. Please try again.'

/** A created workspace is a list row: the create fallback writes it into the list's cache. */
type CreatedWorkspace = inferRouterOutputs<AppRouter>['workspacesList'][number]

/**
 * The one create model (A10): blank or from an example, one pending action at
 * a time, select on success, a message on failure. Both entry points — the
 * sidebar popover and the no-workspaces empty state — consume this hook, and
 * it is the entry contract A09 later builds guidance on.
 */
export const useCreateWorkspaceActions = ({ onCreated }: { onCreated?: () => void } = {}) => {
  const dispatch = useAppDispatch()
  const store = useStore<RootState>()
  const utils = trpc.useUtils()
  const workspaces = useAppSelector(selectWorkspaces)
  const isWorkspacesLoading = useAppSelector(selectWorkspacesLoading)
  const isWorkspacesLoadFailed = useAppSelector(selectWorkspacesLoadFailed)
  const { isAuthenticated, isAuthBootstrapPending } = useAuth()
  // Pending is shared through the store so both entry points hold to one
  // create at a time; the error stays with the surface that asked.
  const pendingKey = useAppSelector(selectCreatePendingKey)
  const createRequestId = useAppSelector(selectCreateRequestId)
  const [error, setError] = useState<string | null>(null)
  // Whether the in-flight create is this surface's own: the surface that asked
  // is the one that renders the outcome, so it must stay up until it lands
  // (or its session ends, which releases the lock).
  const [ownRequestId, setOwnRequestId] = useState<string | null>(null)
  const isRequesting = ownRequestId !== null && ownRequestId === createRequestId

  // A create belongs to the session that started it. Sign-out releases the
  // lock (WorkspaceSync), so a result that lands after that is from an ended
  // session and must not write into whichever session is current.
  const ownsLock = (requestId: string) => store.getState().appShell.createRequestId === requestId

  // Fetch the fresh list and write it to the store *before* selecting the new
  // workspace: the sync component mirrors the query into the store on its own
  // render cycle, and a selection that lands ahead of the list is reset to the
  // first row as "unknown". Ordering both writes here makes it deterministic.
  const settle = async (workspace: CreatedWorkspace, requestId: string) => {
    if (!ownsLock(requestId)) return
    let fresh: ReturnType<typeof toWorkspaceNavItems>
    try {
      fresh = toWorkspaceNavItems(await utils.workspacesList.fetch())
    } catch (error) {
      if (!ownsLock(requestId)) return
      if (isUnauthorizedTrpcError(error)) {
        // The session ended mid-create and the global handler has already
        // cleared the signed-in state; writing the captured list back would
        // hand the previous account's workspaces to whoever signs in next.
        dispatch(endCreate())
        return
      }
      // The create has committed: a failed refresh must not report it as a
      // failed create, or a retry duplicates it. List the returned workspace
      // beside the ones already shown, and let the query reconcile later.
      // The row goes into the query cache as well as the store: were it in the
      // store alone, a later refetch equal to the pre-create list would keep
      // the cached reference, and the sync would never remove the row.
      const listed = [
        ...(utils.workspacesList.getData() ?? []).filter((item) => item.id !== workspace.id),
        workspace,
      ]
      utils.workspacesList.setData(undefined, listed)
      fresh = toWorkspaceNavItems(listed)
      void utils.workspacesList.invalidate()
    }
    if (!ownsLock(requestId)) return
    dispatch(setWorkspaces(fresh))
    dispatch(setActiveWorkspaceId(workspace.id))
    dispatch(endCreate())
    setError(null)
    onCreated?.()
  }
  const fail = (requestId: string) => {
    if (!ownsLock(requestId)) return
    setError(CREATE_FAILED)
    dispatch(endCreate())
  }

  const createBlankMutation = trpc.workspaceCreate.useMutation()
  const createFromExampleMutation = trpc.workspaceCreateFromExample.useMutation()

  // Creating before the list is known — still loading, or failed to load —
  // could duplicate a workspace the user already has but cannot see yet.
  const isAvailable = isAuthenticated && !isAuthBootstrapPending && !isWorkspacesLoading && !isWorkspacesLoadFailed

  // Each request carries its own id to its outcome, so a late result is
  // judged against the lock it took, not against whatever holds it now.
  const start = (key: CreatePendingKey, request: () => Promise<CreatedWorkspace>) => {
    if (!isAvailable || pendingKey) return
    const requestId = nanoid()
    setError(null)
    dispatch(startCreate({ key, requestId }))
    setOwnRequestId(requestId)
    void request().then(
      (workspace) => settle(workspace, requestId),
      () => fail(requestId),
    )
  }

  const createBlank = () =>
    start('blank', () =>
      createBlankMutation.mutateAsync({
        title: `New Workspace ${workspaces.length + 1}`,
        rootNodeTitle: 'Root decision',
        rootNodeSummary: '',
      }),
    )

  const createFromExample = (key: ExampleWorkspaceKey) =>
    start(key, () => createFromExampleMutation.mutateAsync({ key }))

  return {
    examples: EXAMPLE_WORKSPACES,
    createBlank,
    createFromExample,
    pendingKey,
    isRequesting,
    error,
    clearError: () => setError(null),
    isAvailable,
  }
}
