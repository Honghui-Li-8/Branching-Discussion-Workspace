import type { TreeNode, TreeStatus } from '../types/tree'

/**
 * Statuses the Outline lists (A10b; owner pick A2, 2026-09-25): the work still
 * in play. Needs Approval counts as live — it waits on the user — as a
 * provisional default the owner may revisit.
 */
export const LIVE_STATUSES: ReadonlySet<TreeStatus> = new Set<TreeStatus>(['Open', 'Exploring', 'Needs Approval'])

export type OutlineView = {
  /** The root and every kept descendant; children that are not kept are removed. */
  tree: TreeNode
  /** Nodes listed, the root included. */
  shown: number
  /** Nodes in the workspace. */
  total: number
}

const count = (node: TreeNode): number => 1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0)

/** Ids from the root down to `targetId`, inclusive; empty when it is not in the tree. */
const pathTo = (root: TreeNode, targetId: string | null): Set<string> => {
  const path = new Set<string>()
  if (!targetId) return path
  const walk = (node: TreeNode): boolean => {
    if (node.id === targetId || (node.children ?? []).some(walk)) {
      path.add(node.id)
      return true
    }
    return false
  }
  walk(root)
  return path
}

/**
 * The Outline's view of a tree. The root always stays. Below it a node is kept
 * when it is live and its parent was kept — a live node under a resolved parent
 * is left out with that parent — or when it is on the path to the open node, so
 * the highlighted row always appears with its ancestors.
 */
export const liveOutline = (root: TreeNode, openNodeId: string | null): OutlineView => {
  const path = pathTo(root, openNodeId)
  const keep = (node: TreeNode) => LIVE_STATUSES.has(node.status) || path.has(node.id)
  const prune = (node: TreeNode): TreeNode => ({
    ...node,
    children: (node.children ?? []).filter(keep).map(prune),
  })
  const tree = prune(root)
  return { tree, shown: count(tree), total: count(root) }
}
