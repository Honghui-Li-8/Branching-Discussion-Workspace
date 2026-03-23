import { useRef } from 'react'
import { NodeConversationPanel } from './NodeConversationPanel'
import { TreeNodeCard } from './tree/TreeNodeCard'
import { IntroScreen } from './IntroScreen'
import { zIndex } from '../theme/zIndex'
import { useAppSelector } from '../store/hooks'
import { selectActiveWorkspace } from '../store/slices/appShellSlice'
import { findNodeById, CARD_WIDTH } from './tree/treeUtils'
import { useWorkspaceTreeData } from './discussion-tree/hooks/useWorkspaceTreeData'
import { useTreeCanvasWidth } from './discussion-tree/hooks/useTreeCanvasWidth'
import { useDiscussionTreeUiState } from './discussion-tree/hooks/useDiscussionTreeUiState'

type WorkspaceTreeCanvasProps = {
  activeWorkspace: {
    id: string
    title: string
  }
}

const WorkspaceTreeCanvas = ({ activeWorkspace }: WorkspaceTreeCanvasProps) => {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const containerWidth = useTreeCanvasWidth(canvasRef)
  const ui = useDiscussionTreeUiState({ containerWidth })
  const { tree, layout, isLoading: isTreeLoading, error: treeError } = useWorkspaceTreeData({
    workspaceId: activeWorkspace.id,
    foldedNodeIds: ui.foldedNodeIds,
    localMessagesByNodeId: ui.localMessagesByNodeId,
  })
  const conversationNode =
    tree && ui.conversationNodeId ? findNodeById(tree, ui.conversationNodeId) : null

  return (
    <section
      className="relative flex h-auto min-h-[430px] flex-col overflow-hidden rounded-[18px] border border-[#a8d1e5] bg-[linear-gradient(180deg,#f5fbff_0%,#f8fdff_100%)] lg:h-[calc(100vh-40px)] lg:min-h-0"
      aria-label="Discussion tree view"
    >
      <header
        className="relative border-b border-[#c3e0ef] bg-[linear-gradient(90deg,#ebf7ff_0%,#f8fdff_100%)] px-5 py-4"
        style={{ zIndex: zIndex.discussionHeader }}
      >
        <p className="m-0 text-[11px] uppercase tracking-[0.11em] text-[#40718a]">Workspace</p>
        <h1 className="mb-0 mt-1 text-[26px] leading-[1.2] text-[#12384c]">{activeWorkspace.title}</h1>
      </header>

      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 1px 1px, rgba(125, 172, 195, 0.18) 1px, transparent 0) 0 0 / 22px 22px, linear-gradient(180deg, #f8fdff 0%, #fffefb 100%)',
          zIndex: zIndex.canvasBase,
        }}
      >
        <div
          className="h-full overflow-auto"
          style={{
            paddingRight:
              conversationNode && !ui.conversationPanelFullscreen
                ? `${ui.conversationPanelWidth}px`
                : undefined,
          }}
        >
          <div
            className="relative"
            style={layout ? { width: `${layout.width}px`, height: `${layout.height}px` } : undefined}
          >
            {isTreeLoading && !layout ? (
              <p className="m-0 p-6 text-sm text-[#326079]">Loading workspace tree...</p>
            ) : treeError && !layout ? (
              <p className="m-0 p-6 text-sm text-[#8a3f2b]">
                Failed to load workspace tree: {treeError.message}
              </p>
            ) : !layout ? (
              <p className="m-0 p-6 text-sm text-[#326079]">No nodes in this workspace yet.</p>
            ) : (
              <>
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
                  const foldMenuOpen = ui.expandedFoldMenuNodeId === node.id
                  const cardOptionsOpen = ui.expandedCardOptionsNodeId === node.id
                  const cardIsElevated = foldMenuOpen || cardOptionsOpen
                  const foldedCount = node.foldedChildren.length
                  const isConversationSelected = ui.conversationNodeId === node.id

                  return (
                    <TreeNodeCard
                      key={node.id}
                      node={node}
                      isConversationSelected={isConversationSelected}
                      isFoldMenuOpen={foldMenuOpen}
                      isCardOptionsOpen={cardOptionsOpen}
                      foldedCount={foldedCount}
                      onOpenConversation={() => ui.openConversation(node.id)}
                      onCardOptionsOpenChange={(nextOpen) =>
                        ui.onCardOptionsOpenChange(node.id, nextOpen)
                      }
                      onFoldedMenuOpenChange={(nextOpen) =>
                        ui.onFoldedMenuOpenChange(node.id, nextOpen)
                      }
                      onFoldNode={() => ui.foldNode(node.id)}
                      onOpenFoldedNode={(foldedNodeId) => {
                        ui.unfoldNode(foldedNodeId)
                        ui.clearMenus()
                      }}
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
            )}
          </div>
        </div>

        {conversationNode ? (
          <NodeConversationPanel
            key={conversationNode.id}
            node={conversationNode}
            width={ui.panelWidth}
            isFullscreen={ui.isPanelFullscreenLike}
            onClose={ui.closeConversation}
            onSendMessage={ui.sendConversationMessage}
            onWidthChange={ui.handlePanelResize}
            onToggleFullScreen={ui.togglePanelFullScreen}
          />
        ) : null}
      </div>
    </section>
  )
}

export const DiscussionTreeView = () => {
  const activeWorkspace = useAppSelector(selectActiveWorkspace)

  if (!activeWorkspace) {
    return <IntroScreen />
  }

  return <WorkspaceTreeCanvas key={activeWorkspace.id} activeWorkspace={activeWorkspace} />
}
