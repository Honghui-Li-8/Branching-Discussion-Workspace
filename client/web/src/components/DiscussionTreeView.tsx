import { useEffect, useMemo, useRef, useState } from 'react'
import { NodeConversationPanel } from './NodeConversationPanel'
import { TreeNodeCard } from './tree/TreeNodeCard'
import { mockTree } from '../data/mockTree'
import { zIndex } from '../theme/zIndex'
import type { TreeNode } from '../types/tree'
import {
  buildTreeLayout,
  cloneTree,
  findNodeById,
  appendMessagesToNode,
  setNodeFolded,
  CARD_WIDTH,
} from './tree/treeUtils'

const DEFAULT_PANEL_WIDTH = 560
const MIN_PANEL_WIDTH = 300

type DiscussionTreeViewProps = {
  workspaceTitle: string
}

export const DiscussionTreeView = ({ workspaceTitle }: DiscussionTreeViewProps) => {
  const [tree, setTree] = useState<TreeNode>(() => cloneTree(mockTree))
  const [containerWidth, setContainerWidth] = useState(0)
  const [expandedFoldMenuNodeId, setExpandedFoldMenuNodeId] = useState<string | null>(null)
  const [expandedCardOptionsNodeId, setExpandedCardOptionsNodeId] = useState<string | null>(
    null,
  )
  const [conversationNodeId, setConversationNodeId] = useState<string | null>(null)
  const [conversationPanelWidth, setConversationPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [conversationPanelFullscreen, setConversationPanelFullscreen] = useState(false)

  const canvasRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvasElement = canvasRef.current
    if (!canvasElement) {
      return
    }

    const updateContainerWidth = () => {
      setContainerWidth(canvasElement.clientWidth)
    }

    updateContainerWidth()

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(updateContainerWidth)
      resizeObserver.observe(canvasElement)
      return () => {
        resizeObserver.disconnect()
      }
    }

    window.addEventListener('resize', updateContainerWidth)
    return () => {
      window.removeEventListener('resize', updateContainerWidth)
    }
  }, [])

  const layout = useMemo(() => buildTreeLayout(tree), [tree])
  const conversationNode = conversationNodeId ? findNodeById(tree, conversationNodeId) : null
  const isPanelNearFullscreen = containerWidth > 0 && conversationPanelWidth >= containerWidth * 0.8
  const isPanelFullscreenLike = conversationPanelFullscreen || isPanelNearFullscreen

  const panelWidth = conversationPanelFullscreen
    ? containerWidth || conversationPanelWidth
    : conversationPanelWidth

  const foldNode = (nodeId: string) => {
    setTree((current) => setNodeFolded(current, nodeId, true))
    setExpandedFoldMenuNodeId(null)
    setExpandedCardOptionsNodeId(null)
  }

  const unfoldNode = (nodeId: string) => {
    setTree((current) => setNodeFolded(current, nodeId, false))
  }

  const openConversation = (nodeId: string) => {
    setConversationNodeId(nodeId)
    setExpandedFoldMenuNodeId(null)
    setExpandedCardOptionsNodeId(null)
    setConversationPanelFullscreen(false)
    if (containerWidth) {
      setConversationPanelWidth(clampPanelWidth(conversationPanelWidth))
    }
  }

  const sendConversationMessage = (text: string) => {
    if (!conversationNodeId) {
      return
    }

    const trimmed = text.trim()
    if (!trimmed.length) {
      return
    }

    const userMessage = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user' as const,
      content: trimmed,
    }

    const assistantMessage = {
      id: `m-${Date.now() + 1}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant' as const,
      content: `echo: ${trimmed}`,
    }

    setTree((current) =>
      appendMessagesToNode(current, conversationNodeId, [userMessage, assistantMessage]),
    )
  }

  const clampPanelWidth = (candidate: number) => {
    if (!containerWidth) {
      return candidate
    }

    const bounded = Math.min(candidate, containerWidth)
    return Math.max(Math.min(MIN_PANEL_WIDTH, containerWidth), bounded)
  }

  const handlePanelResize = (nextWidth: number) => {
    setConversationPanelWidth(clampPanelWidth(nextWidth))
  }

  const resetPanelToDefault = () => {
    setConversationPanelWidth(clampPanelWidth(DEFAULT_PANEL_WIDTH))
    setConversationPanelFullscreen(false)
  }

  const expandToFullscreen = () => {
    if (containerWidth) {
      setConversationPanelWidth(clampPanelWidth(containerWidth))
    }
    setConversationPanelFullscreen(true)
  }

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
        <h1 className="mb-0 mt-1 text-[26px] leading-[1.2] text-[#12384c]">{workspaceTitle}</h1>
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
              conversationNode && !conversationPanelFullscreen
                ? `${conversationPanelWidth}px`
                : undefined,
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
              const isConversationSelected = conversationNodeId === node.id

              return (
                <TreeNodeCard
                  key={node.id}
                  node={node}
                  isConversationSelected={isConversationSelected}
                  isFoldMenuOpen={foldMenuOpen}
                  isCardOptionsOpen={cardOptionsOpen}
                  foldedCount={foldedCount}
                  onOpenConversation={() => openConversation(node.id)}
                  onCardOptionsOpenChange={(nextOpen) => {
                    if (nextOpen) {
                      setExpandedFoldMenuNodeId(null)
                    }
                    setExpandedCardOptionsNodeId(nextOpen ? node.id : null)
                  }}
                  onFoldedMenuOpenChange={(nextOpen) => {
                    if (nextOpen) {
                      setExpandedCardOptionsNodeId(null)
                    }
                    setExpandedFoldMenuNodeId(nextOpen ? node.id : null)
                  }}
                  onFoldNode={() => foldNode(node.id)}
                  onOpenFoldedNode={(foldedNodeId) => {
                    unfoldNode(foldedNodeId)
                    setExpandedFoldMenuNodeId(null)
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
          </div>
        </div>

        {conversationNode ? (
          <NodeConversationPanel
            key={conversationNode.id}
            node={conversationNode}
            width={panelWidth}
            isFullscreen={isPanelFullscreenLike}
            onClose={() => setConversationNodeId(null)}
            onSendMessage={sendConversationMessage}
            onWidthChange={handlePanelResize}
            onToggleFullScreen={() =>
              isPanelFullscreenLike ? resetPanelToDefault() : expandToFullscreen()
            }
          />
        ) : null}
      </div>
    </section>
  )
}
