import { useState } from 'react'
import type { ExampleWorkspaceKey } from '@branching/shared/router/schemas/core'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  selectCreatePendingKey,
  selectWorkspaces,
  setActiveWorkspaceId,
  setCreatePendingKey,
  setWorkspaces,
  type CreatePendingKey,
} from '../store/slices/appShellSlice'
import { toWorkspaceNavItems } from './workspaceNavItems'
import { trpc } from '../trpc'
import { useAuth } from './useAuth'

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

/**
 * The one create model (A10): blank or from an example, one pending action at
 * a time, select on success, a message on failure. Both entry points — the
 * sidebar popover and the no-workspaces empty state — consume this hook, and
 * it is the entry contract A09 later builds guidance on.
 */
export const useCreateWorkspaceActions = ({ onCreated }: { onCreated?: () => void } = {}) => {
  const dispatch = useAppDispatch()
  const utils = trpc.useUtils()
  const workspaces = useAppSelector(selectWorkspaces)
  const { isAuthenticated, isAuthBootstrapPending } = useAuth()
  // Pending is shared through the store so both entry points hold to one
  // create at a time; the error stays with the surface that asked.
  const pendingKey = useAppSelector(selectCreatePendingKey)
  const setPendingKey = (key: CreatePendingKey | null) => dispatch(setCreatePendingKey(key))
  const [error, setError] = useState<string | null>(null)

  // Fetch the fresh list and write it to the store *before* selecting the new
  // workspace: the sync component mirrors the query into the store on its own
  // render cycle, and a selection that lands ahead of the list is reset to the
  // first row as "unknown". Ordering both writes here makes it deterministic.
  const settle = async (workspace: { id: string }) => {
    const fresh = await utils.workspacesList.fetch()
    dispatch(setWorkspaces(toWorkspaceNavItems(fresh)))
    dispatch(setActiveWorkspaceId(workspace.id))
    setPendingKey(null)
    setError(null)
    onCreated?.()
  }
  const fail = () => {
    setError(CREATE_FAILED)
    setPendingKey(null)
  }

  const createBlankMutation = trpc.workspaceCreate.useMutation({ onSuccess: settle, onError: fail })
  const createFromExampleMutation = trpc.workspaceCreateFromExample.useMutation({
    onSuccess: settle,
    onError: fail,
  })

  const isAvailable = isAuthenticated && !isAuthBootstrapPending

  const createBlank = () => {
    if (!isAvailable || pendingKey) return
    setError(null)
    setPendingKey('blank')
    createBlankMutation.mutate({
      title: `New Workspace ${workspaces.length + 1}`,
      rootNodeTitle: 'Root decision',
      rootNodeSummary: '',
    })
  }

  const createFromExample = (key: ExampleWorkspaceKey) => {
    if (!isAvailable || pendingKey) return
    setError(null)
    setPendingKey(key)
    createFromExampleMutation.mutate({ key })
  }

  return {
    examples: EXAMPLE_WORKSPACES,
    createBlank,
    createFromExample,
    pendingKey,
    error,
    clearError: () => setError(null),
    isAvailable,
  }
}
