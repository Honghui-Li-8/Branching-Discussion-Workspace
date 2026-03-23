import { useRef } from 'react'
import { NodeConversationPanel } from './NodeConversationPanel'
import { IntroScreen } from './IntroScreen'
import { zIndex } from '../theme/zIndex'
import { useAppSelector } from '../store/hooks'
import { selectActiveWorkspace } from '../store/slices/appShellSlice'
import { findNodeById } from './tree/treeUtils'
import { useWorkspaceTreeData } from './discussion-tree/hooks/useWorkspaceTreeData'
import { useTreeCanvasWidth } from './discussion-tree/hooks/useTreeCanvasWidth'
import { useDiscussionTreeUiState } from './discussion-tree/hooks/useDiscussionTreeUiState'
import { TreeCanvasContent } from './discussion-tree/components/TreeCanvasContent'

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
          <TreeCanvasContent
            layout={layout}
            isLoading={isTreeLoading}
            error={treeError}
            conversationNodeId={ui.conversationNodeId}
            expandedFoldMenuNodeId={ui.expandedFoldMenuNodeId}
            expandedCardOptionsNodeId={ui.expandedCardOptionsNodeId}
            onOpenConversation={ui.openConversation}
            onCardOptionsOpenChange={ui.onCardOptionsOpenChange}
            onFoldedMenuOpenChange={ui.onFoldedMenuOpenChange}
            onFoldNode={ui.foldNode}
            onOpenFoldedNode={(foldedNodeId) => {
              ui.unfoldNode(foldedNodeId)
              ui.clearMenus()
            }}
          />
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
