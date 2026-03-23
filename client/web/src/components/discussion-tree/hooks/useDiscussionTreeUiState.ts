import { useMemo, useState } from 'react'
const DEFAULT_PANEL_WIDTH = 560
const MIN_PANEL_WIDTH = 300

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
  const [conversationNodeId, setConversationNodeId] = useState<string | null>(null)
  const [conversationPanelWidth, setConversationPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [conversationPanelFullscreen, setConversationPanelFullscreen] = useState(false)
  const [foldedNodeIds, setFoldedNodeIds] = useState<Record<string, true>>({})

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
      if (!current[nodeId]) {
        return current
      }

      const next = { ...current }
      delete next[nodeId]
      return next
    })
  }

  const openConversation = (nodeId: string) => {
    setConversationNodeId(nodeId)
    clearMenus()
    setConversationPanelFullscreen(false)
    setConversationPanelWidth((current) => clampPanelWidth(current))
  }

  const closeConversation = () => {
    setConversationNodeId(null)
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

  const isPanelNearFullscreen =
    containerWidth > 0 && conversationPanelWidth >= containerWidth * 0.8
  const isPanelFullscreenLike = conversationPanelFullscreen || isPanelNearFullscreen

  const panelWidth = useMemo(
    () =>
      conversationPanelFullscreen
        ? containerWidth || conversationPanelWidth
        : conversationPanelWidth,
    [containerWidth, conversationPanelFullscreen, conversationPanelWidth],
  )

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
    conversationNodeId,
    conversationPanelWidth,
    conversationPanelFullscreen,
    isPanelFullscreenLike,
    panelWidth,
    foldNode,
    unfoldNode,
    openConversation,
    closeConversation,
    handlePanelResize,
    togglePanelFullScreen,
    onCardOptionsOpenChange,
    onFoldedMenuOpenChange,
    clearMenus,
  }
}
