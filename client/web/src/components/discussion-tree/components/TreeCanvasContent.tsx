import type { TRPCClientErrorLike } from '@trpc/client'
import type { AppRouter } from '@branching/shared'
import type { TreeLayout } from '../../tree/treeUtils'
import { TreeCanvasScene } from './TreeCanvasScene'

type TreeCanvasContentProps = {
  layout: TreeLayout | null
  isLoading: boolean
  error: TRPCClientErrorLike<AppRouter> | null
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
 * Content-state switch for the canvas body.
 * Chooses between loading/error/empty messaging and the rendered tree scene.
 */
export const TreeCanvasContent = ({
  layout,
  isLoading,
  error,
  conversationNodeId,
  expandedFoldMenuNodeId,
  expandedCardOptionsNodeId,
  onOpenConversation,
  onCardOptionsOpenChange,
  onFoldedMenuOpenChange,
  onFoldNode,
  onOpenFoldedNode,
}: TreeCanvasContentProps) => {
  return (
    <div
      className="relative"
      style={layout ? { width: `${layout.width}px`, height: `${layout.height}px` } : undefined}
    >
      {isLoading && !layout ? (
        <p className="m-0 p-6 text-sm text-[#326079]">Loading workspace tree...</p>
      ) : error && !layout ? (
        <p className="m-0 p-6 text-sm text-[#8a3f2b]">Failed to load workspace tree: {error.message}</p>
      ) : !layout ? (
        <p className="m-0 p-6 text-sm text-[#326079]">No nodes in this workspace yet.</p>
      ) : (
        <TreeCanvasScene
          layout={layout}
          conversationNodeId={conversationNodeId}
          expandedFoldMenuNodeId={expandedFoldMenuNodeId}
          expandedCardOptionsNodeId={expandedCardOptionsNodeId}
          onOpenConversation={onOpenConversation}
          onCardOptionsOpenChange={onCardOptionsOpenChange}
          onFoldedMenuOpenChange={onFoldedMenuOpenChange}
          onFoldNode={onFoldNode}
          onOpenFoldedNode={onOpenFoldedNode}
        />
      )}
    </div>
  )
}
