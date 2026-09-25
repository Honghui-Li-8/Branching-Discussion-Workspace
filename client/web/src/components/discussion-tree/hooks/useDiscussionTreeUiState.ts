import { useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import { selectOpenNodeId, setOpenNodeId } from '../../../store/slices/appShellSlice'
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
  // A10b: the open node id lives in the store so the sidebar outline can read
  // and set it; only the branch-followup bootstrap stays local, keyed to the
  // node it was created for so a store-side change never replays it.
  const dispatch = useAppDispatch()
  const openNodeId = useAppSelector(selectOpenNodeId)
  const [pendingBootstrap, setPendingBootstrap] = useState<{
    nodeId: string
    bootstrap: BranchFollowupBootstrap
  } | null>(null)
  const conversationTarget = useMemo<ConversationTarget | null>(
    () =>
      openNodeId
        ? {
            nodeId: openNodeId,
            branchFollowupBootstrap:
              pendingBootstrap?.nodeId === openNodeId ? pendingBootstrap.bootstrap : null,
          }
        : null,
    [openNodeId, pendingBootstrap],
  )
  const [conversationPanelWidth, setConversationPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [conversationPanelFullscreen, setConversationPanelFullscreen] = useState(false)
  // Opening a node from outside the canvas (the sidebar outline, A10b) writes
  // the store directly and never runs openConversation. Any open — from here
  // or from the store — starts docked, the same as a canvas open, so the reset
  // follows the open node id rather than living only in the canvas opener.
  const [lastOpenNodeId, setLastOpenNodeId] = useState(openNodeId)
  if (openNodeId !== lastOpenNodeId) {
    setLastOpenNodeId(openNodeId)
    if (openNodeId !== null) setConversationPanelFullscreen(false)
  }
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
    dispatch(setOpenNodeId(nodeId))
    setPendingBootstrap(null)
    clearMenus()
    setConversationPanelFullscreen(false)
    setConversationPanelWidth((current) => clampPanelWidth(current))
  }

  const openConversationWithBranchFollowup = (
    nodeId: string,
    branchFollowupBootstrap: BranchFollowupBootstrap,
  ) => {
    dispatch(setOpenNodeId(nodeId))
    setPendingBootstrap({ nodeId, bootstrap: branchFollowupBootstrap })
    clearMenus()
    setConversationPanelFullscreen(false)
    setConversationPanelWidth((current) => clampPanelWidth(current))
  }

  const closeConversation = () => {
    dispatch(setOpenNodeId(null))
    setPendingBootstrap(null)
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
