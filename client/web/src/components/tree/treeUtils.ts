import type { FoldedNodeSummary, TreeNode } from '../../types/tree'

export const CANVAS_PADDING = 50
export const CARD_WIDTH = 230
const CARD_MAX_HEIGHT = 104
const HORIZONTAL_GAP = 320
const VERTICAL_GAP = 120

export type PositionedNode = {
  id: string
  title: string
  status: TreeNode['status']
  isMerged: boolean
  canFold: boolean
  foldedChildren: FoldedNodeSummary[]
  x: number
  y: number
}

export type TreeEdge = {
  from: string
  to: string
  isMergedChild: boolean
}

export type TreeLayout = {
  nodes: PositionedNode[]
  edges: TreeEdge[]
  nodeById: Map<string, PositionedNode>
  width: number
  height: number
}

export const findNodeById = (node: TreeNode, nodeId: string): TreeNode | null => {
  if (node.id === nodeId) {
    return node
  }

  if (!node.children || node.children.length === 0) {
    return null
  }

  for (const child of node.children) {
    const match = findNodeById(child, nodeId)
    if (match) {
      return match
    }
  }

  return null
}

export const buildTreeLayout = (root: TreeNode): TreeLayout => {
  const nodes: PositionedNode[] = []
  const edges: TreeEdge[] = []
  let leafCursor = 0
  let maxDepth = 0

  const visit = (node: TreeNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth)

    const allChildren = node.children ?? []
    const foldedChildren: FoldedNodeSummary[] = allChildren
      .filter((child) => child.folded)
      .map((child) => ({ id: child.id, title: child.title }))
    const visibleChildren = allChildren.filter((child) => !child.folded)

    const childYs = visibleChildren.map((child) => {
      const childY = visit(child, depth + 1)
      edges.push({ from: node.id, to: child.id, isMergedChild: child.status === 'Merged' })
      return childY
    })

    const y =
      childYs.length === 0
        ? CANVAS_PADDING + leafCursor++ * VERTICAL_GAP
        : childYs.reduce((sum, value) => sum + value, 0) / childYs.length

    nodes.push({
      id: node.id,
      title: node.title,
      status: node.status,
      isMerged: node.status === 'Merged',
      canFold: depth > 0,
      foldedChildren,
      x: CANVAS_PADDING + depth * HORIZONTAL_GAP,
      y,
    })

    return y
  }

  visit(root, 0)

  const width = CANVAS_PADDING * 2 + maxDepth * HORIZONTAL_GAP + CARD_WIDTH
  const height = Math.max(
    420,
    CANVAS_PADDING * 2 + Math.max(leafCursor - 1, 0) * VERTICAL_GAP + CARD_MAX_HEIGHT,
  )

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  return { nodes, edges, nodeById, width, height }
}

export const statusCardClass = (status: TreeNode['status']) => {
  if (status === 'Approved') {
    return 'border-emerald-300'
  }

  if (status === 'Exploring') {
    return 'border-amber-300'
  }

  if (status === 'Merged') {
    return 'border-slate-200 opacity-65'
  }

  return 'border-slate-200'
}
