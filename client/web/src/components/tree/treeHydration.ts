import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import type { TreeNode, TreeStatus } from '../../types/tree'

// Hydration converts flat API node rows into the nested tree model required by the canvas.
// - kept this logic deterministic and defensive so malformed data is still renderable.
type RouterOutputs = inferRouterOutputs<AppRouter>
type HydrationNode = Pick<
  RouterOutputs['nodesByWorkspace'][number],
  'id' | 'parentNodeId' | 'depth' | 'title' | 'status' | 'createdAt'
>

const loggedUnknownStatuses = new Set<string>()

const mapNodeStatusToTreeStatus = (status: HydrationNode['status']): TreeStatus => {
  switch (status) {
    case 'open':
      return 'Open'
    case 'exploring':
      return 'Exploring'
    case 'approved':
      return 'Approved'
    case 'needs_approval':
    case 'deferred':
    case 'closed':
      return 'Open'
    default: {
      const rawStatus = status as string
      if (!loggedUnknownStatuses.has(rawStatus)) {
        loggedUnknownStatuses.add(rawStatus)
        console.warn('[tree-hydration] Unknown node status received from API.', {
          status: rawStatus,
        })
      }
      const _exhaustiveCheck: never = status
      void _exhaustiveCheck
      return 'Open'
    }
  }
}

const parseSortTimestamp = (value: string): number => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Stable ordering keeps sibling placement predictable across renders.
const sortNodes = (nodes: HydrationNode[]): HydrationNode[] =>
  [...nodes].sort((a, b) => {
    const createdAtDelta = parseSortTimestamp(a.createdAt) - parseSortTimestamp(b.createdAt)
    if (createdAtDelta !== 0) {
      return createdAtDelta
    }

    const depthDelta = a.depth - b.depth
    if (depthDelta !== 0) {
      return depthDelta
    }

    return a.id.localeCompare(b.id)
  })

// Root preference:
// 1) canonical self-parent root at depth 0
// 2) first depth 0 node
// 3) first available node as last fallback
const pickRootNode = (nodes: HydrationNode[]): HydrationNode => {
  const strictRoot = nodes.find((node) => node.parentNodeId === node.id && node.depth === 0)
  if (strictRoot) {
    return strictRoot
  }

  const depthRoot = nodes.find((node) => node.depth === 0)
  if (depthRoot) {
    console.warn('[tree-hydration] No strict root node found; using first depth=0 node.')
    return depthRoot
  }

  console.warn('[tree-hydration] No depth=0 node found; using first available node as root.')
  return nodes[0]
}

// Guard against invalid parent chains that would create cycles during tree wiring.
const edgeWouldCreateCycle = (
  childId: string,
  parentId: string,
  parentByNodeId: Map<string, string>,
): boolean => {
  let cursor: string | undefined = parentId
  const visited = new Set<string>()

  while (cursor) {
    if (cursor === childId) {
      return true
    }

    if (visited.has(cursor)) {
      return true
    }

    visited.add(cursor)
    const nextParent = parentByNodeId.get(cursor)
    if (!nextParent || nextParent === cursor) {
      return false
    }
    cursor = nextParent
  }

  return false
}

export const buildTreeFromWorkspaceNodes = (nodes: HydrationNode[]): TreeNode | null => {
  if (nodes.length === 0) {
    return null
  }

  // First pass: normalize and index flat rows.
  const sortedNodes = sortNodes(nodes)
  const rootNode = pickRootNode(sortedNodes)

  const nodeById = new Map(sortedNodes.map((node) => [node.id, node]))
  const parentByNodeId = new Map(sortedNodes.map((node) => [node.id, node.parentNodeId]))
  const treeNodeById = new Map<string, TreeNode>(
    sortedNodes.map((node) => [
      node.id,
      {
        id: node.id,
        title: node.title,
        status: mapNodeStatusToTreeStatus(node.status),
        folded: false,
        children: [],
      },
    ]),
  )

  const attachedNodeIds = new Set<string>()

  // Second pass: connect children to parents when valid.
  for (const node of sortedNodes) {
    if (node.id === rootNode.id) {
      continue
    }

    if (node.parentNodeId === node.id) {
      continue
    }

    const parentTreeNode = treeNodeById.get(node.parentNodeId)
    const currentTreeNode = treeNodeById.get(node.id)
    if (!parentTreeNode || !currentTreeNode) {
      continue
    }

    if (edgeWouldCreateCycle(node.id, node.parentNodeId, parentByNodeId)) {
      console.warn('[tree-hydration] Skipping cyclic parent reference.', {
        nodeId: node.id,
        parentNodeId: node.parentNodeId,
      })
      continue
    }

    parentTreeNode.children = [...(parentTreeNode.children ?? []), currentTreeNode]
    attachedNodeIds.add(node.id)
  }

  const rootTreeNode = treeNodeById.get(rootNode.id)
  if (!rootTreeNode) {
    return null
  }

  // Any node not attached is treated as orphan and reattached to root so it stays visible.
  for (const node of sortedNodes) {
    if (node.id === rootNode.id || attachedNodeIds.has(node.id)) {
      continue
    }

    // Keep orphans visible by reattaching them to the root.
    const orphanTreeNode = treeNodeById.get(node.id)
    if (!orphanTreeNode || !nodeById.has(node.id)) {
      continue
    }

    rootTreeNode.children = [...(rootTreeNode.children ?? []), orphanTreeNode]
  }

  return rootTreeNode
}
