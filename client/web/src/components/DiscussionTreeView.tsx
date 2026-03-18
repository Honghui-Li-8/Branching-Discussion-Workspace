import { useMemo, useState } from 'react'
import { CardOptionsMenu } from './tree/CardOptionsMenu'
import { FoldedNodesMenu } from './tree/FoldedNodesMenu'
import { mockTree } from '../data/mockTree'
import { zIndex } from '../theme/zIndex'
import type { FoldedNodeSummary, TreeNode } from '../types/tree'

const CARD_WIDTH = 230
const CARD_MAX_HEIGHT = 104
const HORIZONTAL_GAP = 320
const VERTICAL_GAP = 120
const CANVAS_PADDING = 50

type PositionedNode = {
  id: string
  title: string
  status: TreeNode['status']
  canFold: boolean
  foldedChildren: FoldedNodeSummary[]
  x: number
  y: number
}

type TreeEdge = {
  from: string
  to: string
}

type TreeLayout = {
  nodes: PositionedNode[]
  edges: TreeEdge[]
  nodeById: Map<string, PositionedNode>
  width: number
  height: number
}

const cloneTree = (node: TreeNode): TreeNode => ({
  ...node,
  messages: node.messages ? [...node.messages] : undefined,
  children: node.children?.map(cloneTree),
})

const setNodeFolded = (node: TreeNode, nodeId: string, folded: boolean): TreeNode => {
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

const buildTreeLayout = (root: TreeNode): TreeLayout => {
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

const statusCardClass = (status: TreeNode['status']) => {
  if (status === 'Approved') {
    return 'border-[#79c89d]'
  }

  if (status === 'Exploring') {
    return 'border-[#ffbe62]'
  }

  return 'border-[#8bb8cd]'
}

type DiscussionTreeViewProps = {
  workspaceTitle: string
}

export const DiscussionTreeView = ({ workspaceTitle }: DiscussionTreeViewProps) => {
  const [tree, setTree] = useState<TreeNode>(() => cloneTree(mockTree))
  const [expandedFoldMenuNodeId, setExpandedFoldMenuNodeId] = useState<string | null>(null)
  const [expandedCardOptionsNodeId, setExpandedCardOptionsNodeId] = useState<string | null>(
    null,
  )

  const layout = useMemo(() => buildTreeLayout(tree), [tree])

  const foldNode = (nodeId: string) => {
    setTree((current) => setNodeFolded(current, nodeId, true))
    setExpandedFoldMenuNodeId(null)
    setExpandedCardOptionsNodeId(null)
  }

  const unfoldNode = (nodeId: string) => {
    setTree((current) => setNodeFolded(current, nodeId, false))
  }

  return (
    <section
      className="flex h-auto min-h-[430px] flex-col overflow-hidden rounded-[18px] border border-[#a8d1e5] bg-[linear-gradient(180deg,#f5fbff_0%,#f8fdff_100%)] lg:h-[calc(100vh-40px)] lg:min-h-0"
      aria-label="Discussion tree view"
    >
      <header
        className="relative border-b border-[#c3e0ef] bg-[linear-gradient(90deg,#ebf7ff_0%,#f8fdff_100%)] px-5 py-4"
        style={{ zIndex: zIndex.discussionHeader }}
      >
        <p className="m-0 text-[11px] uppercase tracking-[0.11em] text-[#40718a]">
          Workspace
        </p>
        <h1 className="mb-0 mt-1 text-[26px] leading-[1.2] text-[#12384c]">
          {workspaceTitle}
        </h1>
      </header>

      <div
        className="flex-1 overflow-auto"
        style={{
          background:
            'radial-gradient(circle at 1px 1px, rgba(125, 172, 195, 0.18) 1px, transparent 0) 0 0 / 22px 22px, linear-gradient(180deg, #f8fdff 0%, #fffefb 100%)',
          zIndex: zIndex.canvasBase,
        }}
      >
        <div
          className="relative"
          style={{ width: `${layout.width}px`, height: `${layout.height}px` }}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{ zIndex: zIndex.edgeLayer }}
          >
            {layout.edges.map((edge) => {
              const from = layout.nodeById.get(edge.from)
              const to = layout.nodeById.get(edge.to)
              if (!from || !to) {
                return null
              }

              const startX = from.x + CARD_WIDTH
              const startY = from.y
              const endX = to.x
              const endY = to.y
              const controlOffset = Math.max(48, (endX - startX) * 0.45)
              const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${
                endX - controlOffset
              } ${endY}, ${endX} ${endY}`

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={path}
                  className="fill-none stroke-[#8bb8cd] stroke-2"
                  style={{ strokeLinecap: 'round' }}
                />
              )
            })}
          </svg>

          {layout.nodes.map((node) => {
            const foldMenuOpen = expandedFoldMenuNodeId === node.id
            const cardOptionsOpen = expandedCardOptionsNodeId === node.id
            const cardIsElevated = foldMenuOpen || cardOptionsOpen
            const foldedCount = node.foldedChildren.length

            return (
              <article
                key={node.id}
                className={`absolute flex min-h-[72px] max-h-[104px] w-[230px] -translate-y-1/2 flex-col gap-2 overflow-visible rounded-[14px] border bg-white p-2.5 shadow-[0_8px_20px_rgba(47,104,130,0.12)] ${statusCardClass(node.status)}`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  zIndex: cardIsElevated ? zIndex.popoverMenu - 1 : zIndex.cardLayer,
                }}
              >
                <CardOptionsMenu
                  canCollapse={node.canFold}
                  isOpen={cardOptionsOpen}
                  onOpenChange={(nextOpen) => {
                    if (nextOpen) {
                      setExpandedFoldMenuNodeId(null)
                    }
                    setExpandedCardOptionsNodeId(nextOpen ? node.id : null)
                  }}
                  onCollapse={() => foldNode(node.id)}
                />

                {foldedCount > 0 ? (
                  <div
                    className="absolute -right-7 top-1/2 -translate-y-1/2"
                    style={{
                      zIndex: cardOptionsOpen ? zIndex.cardLayer : zIndex.inlineControls,
                    }}
                  >
                    <button
                      type="button"
                      className="inline-flex h-6 min-w-8 items-center justify-center rounded-full border border-[#7eb9d5] bg-[#f8fdff] px-1.5 text-[11px] font-semibold text-[#235d79] hover:bg-[#eef9ff]"
                      aria-label={`${foldedCount} folded nodes`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setExpandedCardOptionsNodeId(null)
                        setExpandedFoldMenuNodeId((current) =>
                          current === node.id ? null : node.id,
                        )
                      }}
                    >
                      {foldedCount}+
                    </button>

                    <FoldedNodesMenu
                      isOpen={foldMenuOpen}
                      nodes={node.foldedChildren}
                      onOpenNode={(foldedNodeId) => {
                        unfoldNode(foldedNodeId)
                        setExpandedFoldMenuNodeId(null)
                      }}
                      onClose={() => setExpandedFoldMenuNodeId(null)}
                    />
                  </div>
                ) : null}

                <h3
                  className="m-0 min-h-[1.35em] max-h-[calc(1.35em*3)] overflow-y-auto pr-1 text-sm leading-[1.35] text-[#12384c]"
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {node.title}
                </h3>
                <span className="inline-flex self-start rounded-full border border-[#93bfd3] bg-[#ecf9ff] px-2.5 py-[2px] text-[11px] text-[#2d647f]">
                  {node.status}
                </span>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
