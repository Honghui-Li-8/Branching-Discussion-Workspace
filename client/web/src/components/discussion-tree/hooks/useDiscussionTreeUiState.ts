import { useState } from 'react'
const DEFAULT_PANEL_WIDTH = 560
const MIN_PANEL_WIDTH = 300

export type BranchFollowupBootstrap = {
  turnId: string
  userFollowupMessageId: string | null
  text: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

type ConversationTarget = {
  nodeId: string
  branchFollowupBootstrap: BranchFollowupBootstrap | null
}

type UseDiscussionTreeUiStateParams = {
  containerWidth: number
}

/**
 * Interaction state controller for the discussion tree view.
 * Centralizes fold/menu/conversation/panel state plus event handlers.
 */
export const useDiscussionTreeUiState = ({
  containerWidth,
}: UseDiscussionTreeUiStateParams) => {
  const [expandedFoldMenuNodeId, setExpandedFoldMenuNodeId] = useState<string | null>(null)
  const [expandedCardOptionsNodeId, setExpandedCardOptionsNodeId] = useState<string | null>(null)
  const [conversationTarget, setConversationTarget] = useState<ConversationTarget | null>(null)
  const [conversationPanelWidth, setConversationPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [conversationPanelFullscreen, setConversationPanelFullscreen] = useState(false)
  const [foldedNodeIds, setFoldedNodeIds] = useState<Record<string, boolean>>({})

  const clampPanelWidth = (candidate: number) => {
    if (!containerWidth) {
      return candidate
    }

    const bounded = Math.min(candidate, containerWidth)
    return Math.max(Math.min(MIN_PANEL_WIDTH, containerWidth), bounded)
  }

  const clearMenus = () => {
    setExpandedFoldMenuNodeId(null)
    setExpandedCardOptionsNodeId(null)
  }

  const foldNode = (nodeId: string) => {
    setFoldedNodeIds((current) => {
      if (current[nodeId]) {
        return current
      }

      return { ...current, [nodeId]: true }
    })
    clearMenus()
  }

  const unfoldNode = (nodeId: string) => {
    setFoldedNodeIds((current) => {
      if (current[nodeId] === false) {
        return current
      }

      return { ...current, [nodeId]: false }
    })
  }

  const openConversation = (nodeId: string) => {
    setConversationTarget({
      nodeId,
      branchFollowupBootstrap: null,
    })
    clearMenus()
    setConversationPanelFullscreen(false)
    setConversationPanelWidth((current) => clampPanelWidth(current))
  }

  const openConversationWithBranchFollowup = (
    nodeId: string,
    branchFollowupBootstrap: BranchFollowupBootstrap,
  ) => {
    setConversationTarget({
      nodeId,
      branchFollowupBootstrap,
    })
    clearMenus()
    setConversationPanelFullscreen(false)
    setConversationPanelWidth((current) => clampPanelWidth(current))
  }

  const closeConversation = () => {
    setConversationTarget(null)
  }

  // A resize — pointer drag or the separator's arrow keys — is a docked width:
  // it leaves fullscreen, whose width follows the container, not the store.
  const handlePanelResize = (nextWidth: number) => {
    setConversationPanelWidth(clampPanelWidth(nextWidth))
    setConversationPanelFullscreen(false)
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

  const isPanelNearFullscreen =
    containerWidth > 0 && conversationPanelWidth >= containerWidth * 0.8
  const isPanelFullscreenLike = conversationPanelFullscreen || isPanelNearFullscreen

  // The stored width is what the user chose; the rendered width is clamped to
  // the container as it is now. The panel is a non-shrinking sibling of the
  // canvas, so a width chosen on a wide window must not overflow a narrower
  // one — and widening the window again restores the choice.
  const panelWidth = conversationPanelFullscreen
    ? containerWidth || conversationPanelWidth
    : clampPanelWidth(conversationPanelWidth)

  // The separator's announced range (A10): the clamp's own bounds, widened to
  // include the current width so the value never sits outside its range —
  // before the container is measured, the width is the only bound known.
  const panelWidthMin = Math.min(
    containerWidth ? Math.min(MIN_PANEL_WIDTH, containerWidth) : MIN_PANEL_WIDTH,
    panelWidth,
  )
  const panelWidthMax = Math.max(containerWidth, panelWidth)

  const togglePanelFullScreen = () => {
    if (isPanelFullscreenLike) {
      resetPanelToDefault()
      return
    }

    expandToFullscreen()
  }

  const onCardOptionsOpenChange = (nodeId: string, nextOpen: boolean) => {
    if (nextOpen) {
      setExpandedFoldMenuNodeId(null)
    }
    setExpandedCardOptionsNodeId(nextOpen ? nodeId : null)
  }

  const onFoldedMenuOpenChange = (nodeId: string, nextOpen: boolean) => {
    if (nextOpen) {
      setExpandedCardOptionsNodeId(null)
    }
    setExpandedFoldMenuNodeId(nextOpen ? nodeId : null)
  }

  return {
    foldedNodeIds,
    expandedFoldMenuNodeId,
    expandedCardOptionsNodeId,
    conversationTarget,
    conversationNodeId: conversationTarget?.nodeId ?? null,
    conversationPanelWidth,
    conversationPanelFullscreen,
    isPanelFullscreenLike,
    panelWidth,
    panelWidthMin,
    panelWidthMax,
    foldNode,
    unfoldNode,
    openConversation,
    openConversationWithBranchFollowup,
    closeConversation,
    handlePanelResize,
    togglePanelFullScreen,
    onCardOptionsOpenChange,
    onFoldedMenuOpenChange,
    clearMenus,
  }
}
