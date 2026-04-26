import { useMemo } from 'react'
import type { TRPCClientErrorLike } from '@trpc/client'
import type { AppRouter } from '@branching/shared'
import { trpc } from '../../../trpc'
import type { TreeNode } from '../../../types/tree'
import { buildTreeLayout, type TreeLayout } from '../../tree/treeUtils'
import { buildTreeFromWorkspaceNodes } from '../../tree/treeHydration'

export type FoldedNodeIds = Record<string, boolean>

type WorkspaceTreeData = {
  tree: TreeNode | null
  layout: TreeLayout | null
  isLoading: boolean
  error: TRPCClientErrorLike<AppRouter> | null
}

const applyLocalUiState = (
  node: TreeNode,
  foldedNodeIds: FoldedNodeIds,
): TreeNode => {
  const children = node.children?.map((child) => applyLocalUiState(child, foldedNodeIds))

  const folded =
    node.status === 'Merged'
      ? foldedNodeIds[node.id] !== false
      : foldedNodeIds[node.id] === true

  return {
    ...node,
    folded,
    children,
  }
}

type UseWorkspaceTreeDataParams = {
  workspaceId: string
  foldedNodeIds: FoldedNodeIds
}

/**
 * Fetches workspace nodes and returns the render-ready tree model.
 * Pipeline: query flat rows -> hydrate nested tree -> apply local UI overlays -> build layout.
 */
export const useWorkspaceTreeData = ({
  workspaceId,
  foldedNodeIds,
}: UseWorkspaceTreeDataParams): WorkspaceTreeData => {
  const nodesQuery = trpc.nodesByWorkspace.useQuery({ workspaceId })

  const hydratedTree = useMemo(
    () => buildTreeFromWorkspaceNodes(nodesQuery.data ?? []),
    [nodesQuery.data],
  )
  const tree = useMemo(() => {
    if (!hydratedTree) {
      return null
    }

    return applyLocalUiState(hydratedTree, foldedNodeIds)
  }, [hydratedTree, foldedNodeIds])
  const layout = useMemo(() => (tree ? buildTreeLayout(tree) : null), [tree])

  return {
    tree,
    layout,
    isLoading: nodesQuery.isLoading,
    error: nodesQuery.error,
  }
}
