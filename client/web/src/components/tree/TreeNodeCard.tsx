import { CardOptionsMenu } from './CardOptionsMenu'
import { FoldedNodesMenu } from './FoldedNodesMenu'
import { zIndex } from '../../theme/zIndex'
import { statusCardClass, type PositionedNode } from './treeUtils'

type TreeNodeCardProps = {
  node: PositionedNode
  isConversationSelected: boolean
  isFoldMenuOpen: boolean
  isCardOptionsOpen: boolean
  foldedCount: number
  onOpenConversation: () => void
  onCardOptionsOpenChange: (nextOpen: boolean) => void
  onFoldedMenuOpenChange: (nextOpen: boolean) => void
  onFoldNode: () => void
  onOpenFoldedNode: (nodeId: string) => void
  style: {
    zIndex: number
  }
}

export const TreeNodeCard = ({
  node,
  isConversationSelected,
  isFoldMenuOpen,
  isCardOptionsOpen,
  foldedCount,
  onOpenConversation,
  onCardOptionsOpenChange,
  onFoldedMenuOpenChange,
  onFoldNode,
  onOpenFoldedNode,
  style,
}: TreeNodeCardProps) => (
  <article
    className={`absolute flex min-h-[72px] max-h-[104px] w-[230px] -translate-y-1/2 flex-col gap-2 overflow-visible rounded-2xl border bg-white p-2.5 shadow-[0_8px_20px_rgba(47,104,130,0.12)] ${statusCardClass(
      node.status,
    )} ${isConversationSelected ? 'ring-2 ring-[#4b90ac]' : ''}`}
    style={{
      left: `${node.x}px`,
      top: `${node.y}px`,
      zIndex: style.zIndex,
    }}
    onDoubleClick={onOpenConversation}
  >
    <CardOptionsMenu
      canCollapse={node.canFold}
      isOpen={isCardOptionsOpen}
      onOpenChange={onCardOptionsOpenChange}
      onCollapse={() => {
        onFoldNode()
        onCardOptionsOpenChange(false)
      }}
    />

    {foldedCount > 0 ? (
      <div
        className="absolute -right-7 top-1/2 -translate-y-1/2"
        style={{ zIndex: isCardOptionsOpen ? zIndex.cardLayer : zIndex.inlineControls }}
      >
        <button
          type="button"
          className="inline-flex h-6 min-w-8 items-center justify-center rounded-full border border-[#7eb9d5] bg-[#f8fdff] px-1.5 text-[11px] font-semibold text-[#235d79] hover:bg-[#eef9ff]"
          aria-label={`${foldedCount} folded nodes`}
          onClick={(event) => {
            event.stopPropagation()
            onFoldedMenuOpenChange(foldedCount > 0 ? !isFoldMenuOpen : false)
          }}
        >
          {foldedCount}+
        </button>

        <FoldedNodesMenu
          isOpen={isFoldMenuOpen}
          nodes={node.foldedChildren}
          onOpenNode={(foldedNodeId) => {
            onOpenFoldedNode(foldedNodeId)
            onFoldedMenuOpenChange(false)
          }}
          onClose={() => onFoldedMenuOpenChange(false)}
        />
      </div>
    ) : null}

    <h3
      className="m-0 min-h-[1.35em] max-h-[calc(1.35em*3)] overflow-y-auto pr-1 text-sm leading-[1.35] text-[#12384c]"
      style={{ overflowWrap: 'anywhere' }}
    >
      {node.title}
    </h3>
    {node.isMerged ? (
      <span className="inline-flex self-start rounded-full border border-[#b8d9c8] bg-[#f0f9f4] px-2.5 py-[2px] text-[11px] text-[#3a7a5a]">
        ↩ Merged
      </span>
    ) : (
      <span className="inline-flex self-start rounded-full border border-[#93bfd3] bg-[#ecf9ff] px-2.5 py-[2px] text-[11px] text-[#2d647f]">
        {node.status}
      </span>
    )}
  </article>
)
