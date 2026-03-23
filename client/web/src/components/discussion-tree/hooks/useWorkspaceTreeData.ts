import { useMemo } from 'react'
import type { TRPCClientErrorLike } from '@trpc/client'
import type { AppRouter } from '@branching/shared'
import { trpc } from '../../../trpc'
import type { TreeMessage, TreeNode } from '../../../types/tree'
import { buildTreeLayout, type TreeLayout } from '../../tree/treeUtils'
import { buildTreeFromWorkspaceNodes } from '../../tree/treeHydration'

export type FoldedNodeIds = Record<string, true>
export type LocalMessagesByNodeId = Record<string, TreeMessage[]>

type WorkspaceTreeData = {
  tree: TreeNode | null
  layout: TreeLayout | null
  isLoading: boolean
  error: TRPCClientErrorLike<AppRouter> | null
}

const applyLocalUiState = (
  node: TreeNode,
  foldedNodeIds: FoldedNodeIds,
  localMessagesByNodeId: LocalMessagesByNodeId,
): TreeNode => {
  const children = node.children?.map((child) =>
    applyLocalUiState(child, foldedNodeIds, localMessagesByNodeId),
  )
  const mergedMessages = [...(node.messages ?? []), ...(localMessagesByNodeId[node.id] ?? [])]

  return {
    ...node,
    folded: foldedNodeIds[node.id] === true,
    messages: mergedMessages.length > 0 ? mergedMessages : undefined,
    children,
  }
}

type UseWorkspaceTreeDataParams = {
  workspaceId: string
  foldedNodeIds: FoldedNodeIds
  localMessagesByNodeId: LocalMessagesByNodeId
}

/**
 * Fetches workspace nodes and returns the render-ready tree model.
 * Pipeline: query flat rows -> hydrate nested tree -> apply local UI overlays -> build layout.
 */
export const useWorkspaceTreeData = ({
  workspaceId,
  foldedNodeIds,
  localMessagesByNodeId,
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

    return applyLocalUiState(hydratedTree, foldedNodeIds, localMessagesByNodeId)
  }, [hydratedTree, foldedNodeIds, localMessagesByNodeId])
  const layout = useMemo(() => (tree ? buildTreeLayout(tree) : null), [tree])

  return {
    tree,
    layout,
    isLoading: nodesQuery.isLoading,
    error: nodesQuery.error,
  }
}
