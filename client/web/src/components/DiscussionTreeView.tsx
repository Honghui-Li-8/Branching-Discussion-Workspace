import { useRef } from 'react'
import { NodeConversationPanel } from './NodeConversationPanel'
import { IntroScreen } from './IntroScreen'
import { useAppSelector } from '../store/hooks'
import { selectActiveWorkspace } from '../store/slices/appShellSlice'
import { findNodeById } from './tree/treeUtils'
import { useWorkspaceTreeData } from './discussion-tree/hooks/useWorkspaceTreeData'
import { useTreeCanvasWidth } from './discussion-tree/hooks/useTreeCanvasWidth'
import { useDiscussionTreeUiState } from './discussion-tree/hooks/useDiscussionTreeUiState'
import { TreeCanvasContent } from './discussion-tree/components/TreeCanvasContent'
import { DiscussionTreeShell } from './discussion-tree/components/DiscussionTreeShell'
import { TreeCanvasFrame } from './discussion-tree/components/TreeCanvasFrame'
import { TreeCanvasScrollArea } from './discussion-tree/components/TreeCanvasScrollArea'

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
  })
  const conversationNode =
    tree && ui.conversationTarget?.nodeId
      ? findNodeById(tree, ui.conversationTarget.nodeId)
      : null

  return (
    <DiscussionTreeShell workspaceTitle={activeWorkspace.title}>
      <TreeCanvasFrame canvasRef={canvasRef}>
        <TreeCanvasScrollArea
          hasConversationPanel={conversationNode !== null}
          conversationPanelFullscreen={ui.conversationPanelFullscreen}
          conversationPanelWidth={ui.conversationPanelWidth}
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
        </TreeCanvasScrollArea>

        {conversationNode ? (
          <NodeConversationPanel
            key={`${conversationNode.id}:${ui.conversationTarget?.branchFollowupBootstrap?.turnId ?? 'base'}`}
            node={conversationNode}
            branchFollowupBootstrap={ui.conversationTarget?.branchFollowupBootstrap ?? null}
            onOpenBranchConversation={ui.openConversationWithBranchFollowup}
            width={ui.panelWidth}
            isFullscreen={ui.isPanelFullscreenLike}
            onClose={ui.closeConversation}
            onWidthChange={ui.handlePanelResize}
            onToggleFullScreen={ui.togglePanelFullScreen}
          />
        ) : null}
      </TreeCanvasFrame>
    </DiscussionTreeShell>
  )
}

export const DiscussionTreeView = () => {
  const activeWorkspace = useAppSelector(selectActiveWorkspace)

  if (!activeWorkspace) {
    return <IntroScreen />
  }

  return <WorkspaceTreeCanvas key={activeWorkspace.id} activeWorkspace={activeWorkspace} />
}
