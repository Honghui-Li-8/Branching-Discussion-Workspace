import type { FoldedNodeSummary, TreeMessage, TreeNode } from '../../types/tree'

export const CANVAS_PADDING = 50
export const CARD_WIDTH = 230
const CARD_MAX_HEIGHT = 104
const HORIZONTAL_GAP = 320
const VERTICAL_GAP = 120

export type PositionedNode = {
  id: string
  title: string
  status: TreeNode['status']
  canFold: boolean
  foldedChildren: FoldedNodeSummary[]
  x: number
  y: number
}

export type TreeEdge = {
  from: string
  to: string
}

export type TreeLayout = {
  nodes: PositionedNode[]
  edges: TreeEdge[]
  nodeById: Map<string, PositionedNode>
  width: number
  height: number
}

export const cloneTree = (node: TreeNode): TreeNode => ({
  ...node,
  messages: node.messages ? [...node.messages] : undefined,
  children: node.children?.map(cloneTree),
})

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

export const setNodeFolded = (node: TreeNode, nodeId: string, folded: boolean): TreeNode => {
  if (node.id === nodeId) {
    if (node.folded === folded) {
      return node
    }

    return { ...node, folded }
  }

  if (!node.children || node.children.length === 0) {
    return node
  }

  let changed = false
  const nextChildren = node.children.map((child) => {
    const nextChild = setNodeFolded(child, nodeId, folded)
    if (nextChild !== child) {
      changed = true
    }
    return nextChild
  })

  return changed ? { ...node, children: nextChildren } : node
}

export const appendMessagesToNode = (
  node: TreeNode,
  nodeId: string,
  messages: TreeMessage[],
): TreeNode => {
  if (node.id === nodeId) {
    const existingMessages = node.messages ?? []
    return { ...node, messages: [...existingMessages, ...messages] }
  }

  if (!node.children || node.children.length === 0) {
    return node
  }

  let changed = false
  const nextChildren = node.children.map((child) => {
    const nextChild = appendMessagesToNode(child, nodeId, messages)
    if (nextChild !== child) {
      changed = true
    }

    return nextChild
  })

  return changed ? { ...node, children: nextChildren } : node
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
      edges.push({ from: node.id, to: child.id })
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
    return 'border-[#79c89d]'
  }

  if (status === 'Exploring') {
    return 'border-[#ffbe62]'
  }

  return 'border-[#8bb8cd]'
}
