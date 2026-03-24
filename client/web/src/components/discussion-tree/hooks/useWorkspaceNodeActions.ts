import type { inferRouterInputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import { trpc } from '../../../trpc'
import { invalidateNodesByWorkspace } from './mutationInvalidation'

type RouterInputs = inferRouterInputs<AppRouter>
type NodeCreateInput = RouterInputs['nodeCreate']
type NodeUpdateInput = RouterInputs['nodeUpdate']
type NodeDeleteInput = RouterInputs['nodeDelete']

type UseWorkspaceNodeActionsParams = {
  workspaceId: string
}

type WorkspaceNodeActions = {
  createNode: (input: Omit<NodeCreateInput, 'workspaceId'>) => void
  updateNode: (input: NodeUpdateInput) => void
  deleteNode: (input: NodeDeleteInput) => void
  isCreatingNode: boolean
  isUpdatingNode: boolean
  isDeletingNode: boolean
  createNodeError: string | null
  updateNodeError: string | null
  deleteNodeError: string | null
}

/**
 * Centralized node mutations for a workspace.
 * Any successful node write invalidates nodesByWorkspace for the active workspace.
 */
export const useWorkspaceNodeActions = ({
  workspaceId,
}: UseWorkspaceNodeActionsParams): WorkspaceNodeActions => {
  const utils = trpc.useUtils()

  const invalidateWorkspaceNodes = async () => {
    await invalidateNodesByWorkspace(utils.nodesByWorkspace.invalidate, workspaceId)
  }

  const createNodeMutation = trpc.nodeCreate.useMutation({
    onSuccess: invalidateWorkspaceNodes,
  })
  const updateNodeMutation = trpc.nodeUpdate.useMutation({
    onSuccess: invalidateWorkspaceNodes,
  })
  const deleteNodeMutation = trpc.nodeDelete.useMutation({
    onSuccess: invalidateWorkspaceNodes,
  })

  const createNode = (input: Omit<NodeCreateInput, 'workspaceId'>) => {
    createNodeMutation.reset()
    createNodeMutation.mutate({
      workspaceId,
      ...input,
    })
  }

  const updateNode = (input: NodeUpdateInput) => {
    updateNodeMutation.reset()
    updateNodeMutation.mutate(input)
  }

  const deleteNode = (input: NodeDeleteInput) => {
    deleteNodeMutation.reset()
    deleteNodeMutation.mutate(input)
  }

  return {
    createNode,
    updateNode,
    deleteNode,
    isCreatingNode: createNodeMutation.isPending,
    isUpdatingNode: updateNodeMutation.isPending,
    isDeletingNode: deleteNodeMutation.isPending,
    createNodeError: createNodeMutation.error?.message ?? null,
    updateNodeError: updateNodeMutation.error?.message ?? null,
    deleteNodeError: deleteNodeMutation.error?.message ?? null,
  }
}
