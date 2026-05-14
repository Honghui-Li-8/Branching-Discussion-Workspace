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
    className={`absolute flex min-h-[72px] max-h-[104px] w-[230px] -translate-y-1/2 flex-col gap-2 overflow-visible rounded-xl border bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.1)] transition-shadow hover:shadow-[0_16px_38px_rgba(15,23,42,0.14)] ${statusCardClass(
      node.status,
    )} ${isConversationSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white' : ''}`}
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
          className="inline-flex h-6 min-w-8 items-center justify-center rounded-full border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
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
      className="m-0 min-h-[1.35em] max-h-[calc(1.35em*3)] overflow-y-auto pr-1 text-sm font-semibold leading-[1.35] text-slate-950"
      style={{ overflowWrap: 'anywhere' }}
    >
      {node.title}
    </h3>
    {node.isMerged ? (
      <span className="inline-flex self-start rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-[2px] text-[11px] font-medium text-emerald-700">
        ↩ Merged
      </span>
    ) : node.status !== 'Open' ? (
      <span className="inline-flex self-start rounded-full border border-slate-200 bg-slate-50 px-2.5 py-[2px] text-[11px] font-medium text-slate-600">
        {node.status}
      </span>
    ) : null}
  </article>
)
