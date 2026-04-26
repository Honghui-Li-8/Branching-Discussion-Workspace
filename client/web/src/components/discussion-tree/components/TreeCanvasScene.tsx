import { TreeNodeCard } from '../../tree/TreeNodeCard'
import { zIndex } from '../../../theme/zIndex'
import { CARD_WIDTH, type TreeLayout } from '../../tree/treeUtils'

type TreeCanvasSceneProps = {
  layout: TreeLayout
  conversationNodeId: string | null
  expandedFoldMenuNodeId: string | null
  expandedCardOptionsNodeId: string | null
  onOpenConversation: (nodeId: string) => void
  onCardOptionsOpenChange: (nodeId: string, nextOpen: boolean) => void
  onFoldedMenuOpenChange: (nodeId: string, nextOpen: boolean) => void
  onFoldNode: (nodeId: string) => void
  onOpenFoldedNode: (foldedNodeId: string) => void
}

/**
 * Pure renderer for tree geometry and cards.
 * Draws link paths and node cards using a precomputed layout.
 */
export const TreeCanvasScene = ({
  layout,
  conversationNodeId,
  expandedFoldMenuNodeId,
  expandedCardOptionsNodeId,
  onOpenConversation,
  onCardOptionsOpenChange,
  onFoldedMenuOpenChange,
  onFoldNode,
  onOpenFoldedNode,
}: TreeCanvasSceneProps) => {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ zIndex: zIndex.edgeLayer }}
      >
        <defs>
          <marker
            id="merged-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto-start-reverse"
          >
            <path d="M 8 0 L 0 4 L 8 8 Z" fill="#79c89d" />
          </marker>
        </defs>
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

          if (edge.isMergedChild) {
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={path}
                fill="none"
                stroke="#79c89d"
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeLinecap="round"
                markerEnd="url(#merged-arrow)"
              />
            )
          }

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
        const isConversationSelected = conversationNodeId === node.id

        return (
          <TreeNodeCard
            key={node.id}
            node={node}
            isConversationSelected={isConversationSelected}
            isFoldMenuOpen={foldMenuOpen}
            isCardOptionsOpen={cardOptionsOpen}
            foldedCount={foldedCount}
            onOpenConversation={() => onOpenConversation(node.id)}
            onCardOptionsOpenChange={(nextOpen) => onCardOptionsOpenChange(node.id, nextOpen)}
            onFoldedMenuOpenChange={(nextOpen) => onFoldedMenuOpenChange(node.id, nextOpen)}
            onFoldNode={() => onFoldNode(node.id)}
            onOpenFoldedNode={onOpenFoldedNode}
            style={{
              zIndex: cardIsElevated
                ? zIndex.popoverMenu - 1
                : isConversationSelected
                  ? zIndex.popoverMenu
                  : zIndex.cardLayer,
            }}
          />
        )
      })}
    </>
  )
}
