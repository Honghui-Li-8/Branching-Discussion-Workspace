import { useMemo } from 'react'
import { mockTree } from '../data/mockTree'
import type { TreeNode } from '../types/tree'

const CARD_WIDTH = 230
const CARD_MAX_HEIGHT = 104
const HORIZONTAL_GAP = 320
const VERTICAL_GAP = 120
const CANVAS_PADDING = 50

type PositionedNode = {
  id: string
  title: string
  status: TreeNode['status']
  x: number
  y: number
}

type TreeEdge = {
  from: string
  to: string
}

const buildTreeLayout = (root: TreeNode) => {
  const nodes: PositionedNode[] = []
  const edges: TreeEdge[] = []
  let leafCursor = 0
  let maxDepth = 0

  const visit = (node: TreeNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth)
    const children = node.children ?? []

    const childYs = children.map((child) => {
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
  const layout = useMemo(() => buildTreeLayout(mockTree), [])

  return (
    <section
      className="flex h-auto min-h-[430px] flex-col overflow-hidden rounded-[18px] border border-[#a8d1e5] bg-[linear-gradient(180deg,#f5fbff_0%,#f8fdff_100%)] lg:h-[calc(100vh-40px)] lg:min-h-0"
      aria-label="Discussion tree view"
    >
      <header className="border-b border-[#c3e0ef] bg-[linear-gradient(90deg,#ebf7ff_0%,#f8fdff_100%)] px-5 py-4">
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
        }}
      >
        <div
          className="relative"
          style={{ width: `${layout.width}px`, height: `${layout.height}px` }}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
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

          {layout.nodes.map((node) => (
            <article
              key={node.id}
              className={`absolute flex min-h-[72px] max-h-[104px] w-[230px] -translate-y-1/2 flex-col gap-2 overflow-hidden rounded-[14px] border bg-white p-2.5 shadow-[0_8px_20px_rgba(47,104,130,0.12)] ${statusCardClass(node.status)}`}
              style={{ left: `${node.x}px`, top: `${node.y}px` }}
            >
              <h3
                className="m-0 min-h-[1.35em] max-h-[calc(1.35em*3)] overflow-y-auto pr-1 text-sm leading-[1.35] text-[#12384c]"
                style={{
                  overflowWrap: 'anywhere',
                }}
              >
                {node.title}
              </h3>
              <span className="inline-flex self-start rounded-full border border-[#93bfd3] bg-[#ecf9ff] px-2.5 py-[2px] text-[11px] text-[#2d647f]">
                {node.status}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
