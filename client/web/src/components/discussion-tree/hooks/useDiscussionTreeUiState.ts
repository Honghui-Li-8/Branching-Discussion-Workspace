import { useMemo, useState } from 'react'
import type { TreeMessage } from '../../../types/tree'

const DEFAULT_PANEL_WIDTH = 560
const MIN_PANEL_WIDTH = 300

type UseDiscussionTreeUiStateParams = {
  containerWidth: number
}

export const useDiscussionTreeUiState = ({
  containerWidth,
}: UseDiscussionTreeUiStateParams) => {
  const [expandedFoldMenuNodeId, setExpandedFoldMenuNodeId] = useState<string | null>(null)
  const [expandedCardOptionsNodeId, setExpandedCardOptionsNodeId] = useState<string | null>(null)
  const [conversationNodeId, setConversationNodeId] = useState<string | null>(null)
  const [conversationPanelWidth, setConversationPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [conversationPanelFullscreen, setConversationPanelFullscreen] = useState(false)
  const [foldedNodeIds, setFoldedNodeIds] = useState<Record<string, true>>({})
  const [localMessagesByNodeId, setLocalMessagesByNodeId] = useState<
    Record<string, TreeMessage[]>
  >({})

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

  const sendConversationMessage = (text: string) => {
    if (!conversationNodeId) {
      return
    }

    const trimmed = text.trim()
    if (!trimmed.length) {
      return
    }

    const userMessage: TreeMessage = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmed,
    }

    const assistantMessage: TreeMessage = {
      id: `m-${Date.now() + 1}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: `echo: ${trimmed}`,
    }

    setLocalMessagesByNodeId((current) => ({
      ...current,
      [conversationNodeId]: [...(current[conversationNodeId] ?? []), userMessage, assistantMessage],
    }))
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
    localMessagesByNodeId,
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
    sendConversationMessage,
    handlePanelResize,
    togglePanelFullScreen,
    onCardOptionsOpenChange,
    onFoldedMenuOpenChange,
    clearMenus,
  }
}
