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
    conversationTarget,
    conversationNodeId: conversationTarget?.nodeId ?? null,
    conversationPanelWidth,
    conversationPanelFullscreen,
    isPanelFullscreenLike,
    panelWidth,
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
