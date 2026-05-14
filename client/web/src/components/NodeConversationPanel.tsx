import {
  type KeyboardEvent,
  type SubmitEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { zIndex } from '../theme/zIndex'
import type { TreeMessage, TreeNode } from '../types/tree'
import { useAppSelector } from '../store/hooks'
import { selectAuthUser } from '../store/slices/authSlice'
import { selectActiveWorkspace } from '../store/slices/appShellSlice'
import { trpc } from '../trpc'
import { useNodeConversation } from './discussion-tree/hooks/useNodeConversation'
import { useBranchConversationView } from './discussion-tree/hooks/useBranchConversationView'
import type { TurnStage } from './discussion-tree/hooks/conversationStreamState'
import type { BranchFollowupBootstrap } from './discussion-tree/hooks/useDiscussionTreeUiState'
import { invalidateMessagesByNode, invalidateNodesByWorkspace } from './discussion-tree/hooks/mutationInvalidation'
import { parseMergeProposalMetadata, STRUCTURAL_MESSAGE_TYPES } from '@branching/shared'
import { isMergeProposalPending } from './merge/mergeProposalCardLogic'
import { ConversationComposer, CHAT_INPUT_MAX_HEIGHT, CHAT_INPUT_MIN_HEIGHT, CHAT_MODELS } from './conversation/ConversationComposer'
import { ConversationMessageList } from './conversation/ConversationMessageList'
import { ConversationPanelHeader } from './conversation/ConversationPanelHeader'

type NodeConversationPanelProps = {
  node: TreeNode
  branchFollowupBootstrap: BranchFollowupBootstrap | null
  onOpenBranchConversation: (
    nodeId: string,
    branchFollowupBootstrap: BranchFollowupBootstrap,
  ) => void
  width: number
  isFullscreen: boolean
  onClose: () => void
  onWidthChange: (nextWidth: number) => void
  onToggleFullScreen: () => void
}

const formatStatusElapsed = (elapsedSeconds: number): string => {
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`
  }

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

const getNodeConclusion = (messages: TreeMessage[] | undefined) => {
  if (!messages || messages.length === 0) {
    return 'No conclusion yet.'
  }

  const lastMessage = [...messages].reverse().find((message) => message.role === 'assistant')
  const rawConclusion = lastMessage?.content ?? messages[messages.length - 1].content
  const normalizedConclusion = rawConclusion
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalizedConclusion.length) {
    return 'No conclusion yet.'
  }

  const MAX_CONCLUSION_LENGTH = 140
  return normalizedConclusion.length > MAX_CONCLUSION_LENGTH
    ? `${normalizedConclusion.slice(0, MAX_CONCLUSION_LENGTH - 1)}…`
    : normalizedConclusion
}

const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 48

const isNearBottom = (element: HTMLDivElement): boolean =>
  element.scrollHeight - (element.scrollTop + element.clientHeight) <=
  AUTO_SCROLL_BOTTOM_THRESHOLD_PX

const getStageLabel = (stage: TurnStage): string => {
  switch (stage) {
    case 'loading_context':
      return 'Context'
    case 'retrieving':
      return 'Retrieval'
    case 'awaiting_model':
      return 'Model wait'
    case 'generating':
      return 'Generating'
    case 'summarizing':
      return 'Summarizing'
    case 'persisting':
      return 'Saving'
    default:
      return stage
  }
}

const formatStageDuration = (durationMs: number): string => {
  const seconds = Math.max(0, Math.floor(durationMs / 1000))
  return formatStatusElapsed(seconds)
}

/**
 * Conversation side panel for a selected tree node.
 * Renders node messages, input composer, and resize/fullscreen controls.
 */
export const NodeConversationPanel = ({
  node,
  branchFollowupBootstrap,
  onOpenBranchConversation,
  width,
  isFullscreen,
  onClose,
  onWidthChange,
  onToggleFullScreen,
}: NodeConversationPanelProps) => {
  const authUser = useAppSelector(selectAuthUser)
  const activeWorkspace = useAppSelector(selectActiveWorkspace)
  const [conversationModel, setConversationModel] = useState(CHAT_MODELS[0])
  const conversation = useNodeConversation({
    nodeId: node.id,
    canSendMessages: Boolean(authUser?.id),
    conversationModel,
    branchFollowupBootstrap,
  })
  const conversationView = useBranchConversationView({
    nodeId: node.id,
    localMessages: conversation.messages,
  })
  const [conversationInputText, setConversationInputText] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [sendBlockAlert, setSendBlockAlert] = useState<string | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [mergeTimerStartedAtMs, setMergeTimerStartedAtMs] = useState<number | null>(null)
  const [mergeTimerNowMs, setMergeTimerNowMs] = useState(0)
  const [mergeCompletionMessage, setMergeCompletionMessage] = useState<string | null>(null)
  const [mergeStatusLabel, setMergeStatusLabel] = useState<string | null>(null)

  const utils = trpc.useUtils()

  const invalidateAfterMergeAction = useCallback(async () => {
    await Promise.all([
      invalidateMessagesByNode(utils.messagesByNode.invalidate, node.id),
      activeWorkspace
        ? invalidateNodesByWorkspace(utils.nodesByWorkspace.invalidate, activeWorkspace.id)
        : Promise.resolve(),
    ])
  }, [utils.messagesByNode.invalidate, utils.nodesByWorkspace.invalidate, node.id, activeWorkspace])

  const onNodeIsMerged = useCallback(async () => {
    await invalidateAfterMergeAction()
  }, [invalidateAfterMergeAction])

  const onMergeActionPending = useCallback((label: string): number => {
    mergeActionTokenRef.current += 1
    setMergeStatusLabel(label)
    return mergeActionTokenRef.current
  }, [])

  const onMergeActionSettled = useCallback((token: number) => {
    if (token === mergeActionTokenRef.current) {
      setMergeStatusLabel(null)
    }
  }, [])

  const initiateNodeMergeMutation = trpc.initiateNodeMerge.useMutation({
    onError: (error) => {
      setMergeError(error.message === 'NODE_IS_MERGED' ? 'This node is already merged.' : 'Failed to initiate merge. Please try again.')
    },
    onSuccess: async () => {
      setMergeError(null)
      await invalidateAfterMergeAction()
      setMergeCompletionMessage('Proposal ready')
      if (mergeCompletionTimeoutRef.current !== null) {
        clearTimeout(mergeCompletionTimeoutRef.current)
      }
      mergeCompletionTimeoutRef.current = setTimeout(() => {
        setMergeCompletionMessage(null)
        mergeCompletionTimeoutRef.current = null
      }, 4000)
    },
    onSettled: () => {
      setMergeStatusLabel(null)
    },
  })

  const cancelMergeMutation = trpc.cancelMerge.useMutation({
    onError: () => {
      setMergeError('Failed to cancel merge. Please try again.')
    },
    onSuccess: async () => {
      setMergeError(null)
      await invalidateAfterMergeAction()
    },
    onSettled: () => {
      setMergeStatusLabel(null)
    },
  })

  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const mergeCompletionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mergeActionTokenRef = useRef(0)
  const conversationScrollRef = useRef<HTMLDivElement | null>(null)
  const conversationBottomAnchorRef = useRef<HTMLDivElement | null>(null)
  const conversationInputRef = useRef<HTMLTextAreaElement | null>(null)
  const isPinnedToBottomRef = useRef(true)
  const stageOrderRef = useRef<TurnStage[]>([])
  const currentTimedStageRef = useRef<TurnStage | null>(null)
  const currentStageStartedAtMsRef = useRef<number | null>(null)
  const [statusTimerStartedAtMs, setStatusTimerStartedAtMs] = useState<number | null>(null)
  const [statusTimerNowMs, setStatusTimerNowMs] = useState(0)
  const [stageDurationsMs, setStageDurationsMs] = useState<Partial<Record<TurnStage, number>>>({})

  const messages = conversationView.messages
  const lastMessageContent = messages[messages.length - 1]?.content ?? ''
  const hasFailedMessages = conversation.failedMessageIds.size > 0
  const streamStatusLabel = conversation.streamStatusLabel

  const isMerged = node.status === 'Merged'
  const isRootNode = node.depth === 0
  const hasPendingProposal = messages.some(
    (m) => m.metadata?.eventType === STRUCTURAL_MESSAGE_TYPES.mergeProposal && isMergeProposalPending(parseMergeProposalMetadata(m.metadata)),
  )
  const isMergeInitiating = initiateNodeMergeMutation.isPending
  const isMergeBlocked = isMerged || isMergeInitiating || hasPendingProposal
  const hasActiveStreamStatus =
    Boolean(streamStatusLabel) && !(streamStatusLabel?.startsWith('Error:') ?? false)
  const runtimeSummary = (() => {
    const stageOrder = stageOrderRef.current
    if (stageOrder.length === 0) {
      return null
    }

    const segmentSummaries: string[] = []
    let totalDurationMs = 0
    for (const stage of stageOrder) {
      const durationMs = stageDurationsMs[stage] ?? 0
      totalDurationMs += durationMs
      segmentSummaries.push(`${getStageLabel(stage)} ${formatStageDuration(durationMs)}`)
    }

    return `${segmentSummaries.join(' • ')} • Total ${formatStageDuration(totalDurationMs)}`
  })()

  const scrollConversationToBottom = () => {
    const bottomAnchor = conversationBottomAnchorRef.current
    if (bottomAnchor) {
      bottomAnchor.scrollIntoView({ block: 'end' })
    }

    const scrollContainer = conversationScrollRef.current
    if (!scrollContainer) {
      return
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight
  }

  const adjustConversationInputHeight = () => {
    const input = conversationInputRef.current
    if (!input) {
      return
    }

    input.style.height = 'auto'
    input.style.height = `${Math.min(
      Math.max(input.scrollHeight, CHAT_INPUT_MIN_HEIGHT),
      CHAT_INPUT_MAX_HEIGHT,
    )}px`
    input.style.overflowY = input.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden'
  }

  useEffect(() => {
    if (conversationInputRef.current) {
      conversationInputRef.current.style.height = `${CHAT_INPUT_MIN_HEIGHT}px`
      conversationInputRef.current.style.overflowY = 'hidden'
    }
  }, [node.id])

  useLayoutEffect(() => {
    const scrollContainer = conversationScrollRef.current
    if (!scrollContainer) {
      return
    }

    if (!isPinnedToBottomRef.current) {
      return
    }

    scrollConversationToBottom()
    const rafId = window.requestAnimationFrame(() => {
      if (!isPinnedToBottomRef.current) {
        return
      }
      scrollConversationToBottom()
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [lastMessageContent, messages.length, node.id])

  useEffect(() => {
    const scrollContainer = conversationScrollRef.current
    if (!scrollContainer) {
      return
    }

    isPinnedToBottomRef.current = true
    scrollConversationToBottom()

    const handleScroll = () => {
      isPinnedToBottomRef.current = isNearBottom(scrollContainer)
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [node.id])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const scrollContainer = conversationScrollRef.current
    if (!scrollContainer) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!isPinnedToBottomRef.current) {
        return
      }

      scrollConversationToBottom()
    })
    const messageStack = scrollContainer.firstElementChild
    resizeObserver.observe(scrollContainer)
    if (messageStack instanceof HTMLElement) {
      resizeObserver.observe(messageStack)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [node.id])

  useEffect(() => {
    adjustConversationInputHeight()
  }, [conversationInputText])

  useEffect(() => {
    if (!hasActiveStreamStatus) {
      return
    }

    const intervalId = window.setInterval(() => {
      setStatusTimerNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hasActiveStreamStatus, node.id])

  useEffect(() => {
    const now = Date.now()
    const nextStage = hasActiveStreamStatus ? conversation.streamStage : null
    const previousStage = currentTimedStageRef.current

    if (
      previousStage !== null &&
      previousStage !== nextStage &&
      currentStageStartedAtMsRef.current !== null
    ) {
      const elapsedMs = Math.max(0, now - currentStageStartedAtMsRef.current)
      if (!stageOrderRef.current.includes(previousStage)) {
        stageOrderRef.current.push(previousStage)
      }
      setStageDurationsMs((current) => ({
        ...current,
        [previousStage]: (current[previousStage] ?? 0) + elapsedMs,
      }))
      currentStageStartedAtMsRef.current = null
    }

    if (nextStage !== null && previousStage !== nextStage) {
      currentTimedStageRef.current = nextStage
      currentStageStartedAtMsRef.current = now
      setStatusTimerStartedAtMs(now)
      setStatusTimerNowMs(now)
      return
    }

    if (nextStage === null) {
      currentTimedStageRef.current = null
      currentStageStartedAtMsRef.current = null
    }
  }, [conversation.streamStage, hasActiveStreamStatus])

  useEffect(() => {
    stageOrderRef.current = []
    currentTimedStageRef.current = null
    currentStageStartedAtMsRef.current = null
    setStageDurationsMs({})
    setStatusTimerStartedAtMs(null)
    setStatusTimerNowMs(0)
    setMergeTimerStartedAtMs(null)
    setMergeTimerNowMs(0)
    setMergeCompletionMessage(null)
    setMergeStatusLabel(null)
    mergeActionTokenRef.current = 0
    if (mergeCompletionTimeoutRef.current !== null) {
      clearTimeout(mergeCompletionTimeoutRef.current)
      mergeCompletionTimeoutRef.current = null
    }
  }, [node.id])

  useEffect(() => {
    if (!mergeStatusLabel) {
      return
    }
    setMergeCompletionMessage(null)
    if (mergeCompletionTimeoutRef.current !== null) {
      clearTimeout(mergeCompletionTimeoutRef.current)
      mergeCompletionTimeoutRef.current = null
    }
    const now = Date.now()
    setMergeTimerStartedAtMs(now)
    setMergeTimerNowMs(now)
    const intervalId = window.setInterval(() => {
      setMergeTimerNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [mergeStatusLabel])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const delta = startXRef.current - event.clientX
      const nextWidth = Math.round(startWidthRef.current + delta)
      onWidthChange(nextWidth)
    }

    const handlePointerUp = () => {
      setIsResizing(false)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isResizing, onWidthChange])

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    startXRef.current = event.clientX
    startWidthRef.current = width
    setIsResizing(true)
    onWidthChange(width)
  }

  const sendConversationMessage = () => {
    if (isMergeBlocked) {
      if (isMerged) {
        setSendBlockAlert('This node has been merged and is read-only.')
      } else if (hasPendingProposal) {
        setSendBlockAlert('A merge proposal is pending. Approve, edit, or reject it first.')
      }
      return
    }

    const text = conversationInputText.trim()
    if (!text.length) {
      return
    }

    const didQueueSend = conversation.sendMessage(text)
    if (!didQueueSend) {
      if (!authUser?.id) {
        setSendBlockAlert('Login required. Please sign in before sending messages.')
      } else if (conversation.isSendingMessage) {
        setSendBlockAlert('A message is already sending. Please wait a moment.')
      } else {
        setSendBlockAlert('Unable to send message right now. Please try again.')
      }
      return
    }

    setSendBlockAlert(null)
    setConversationInputText('')
    stageOrderRef.current = []
    currentTimedStageRef.current = null
    currentStageStartedAtMsRef.current = null
    setStageDurationsMs({})
    const now = Date.now()
    setStatusTimerStartedAtMs(now)
    setStatusTimerNowMs(now)

    if (conversationInputRef.current) {
      conversationInputRef.current.style.overflowY = 'hidden'
      conversationInputRef.current.style.height = `${CHAT_INPUT_MIN_HEIGHT}px`
    }
  }

  const handleConversationSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendConversationMessage()
  }

  const handleConversationKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendConversationMessage()
    }
  }

  const streamStatusWithElapsed = (() => {
    if (!streamStatusLabel || !hasActiveStreamStatus || statusTimerStartedAtMs === null) {
      return streamStatusLabel
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((statusTimerNowMs - statusTimerStartedAtMs) / 1000),
    )
    return `${streamStatusLabel} (${formatStatusElapsed(elapsedSeconds)})`
  })()

  const mergeStatusWithElapsed = (() => {
    if (!mergeStatusLabel || mergeTimerStartedAtMs === null) {
      return null
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((mergeTimerNowMs - mergeTimerStartedAtMs) / 1000),
    )
    return `${mergeStatusLabel} (${formatStatusElapsed(elapsedSeconds)})`
  })()

  const messageSendErrorEntry =
    conversation.messageSendError && !hasFailedMessages
      ? conversation.messageSendError
      : null

  type StatusSeverity = 'error' | 'merge' | 'info'

  const activeStatusEntry: { message: string; severity: StatusSeverity } | null =
    sendBlockAlert
      ? { message: sendBlockAlert, severity: 'error' }
      : messageSendErrorEntry
        ? { message: `Failed to send message: ${messageSendErrorEntry}`, severity: 'error' }
        : mergeError
          ? { message: mergeError, severity: 'error' }
          : mergeStatusWithElapsed
            ? { message: mergeStatusWithElapsed, severity: 'merge' }
            : mergeCompletionMessage
              ? { message: mergeCompletionMessage, severity: 'merge' }
              : streamStatusWithElapsed
                ? { message: streamStatusWithElapsed, severity: 'info' }
                : isMerged
                  ? { message: 'This branch has been merged. The conversation is read-only.', severity: 'merge' }
                  : null

  const statusBarClass: Record<StatusSeverity, string> = {
    error: 'border-red-200 bg-red-50 text-red-700',
    merge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info:  'border-blue-100 bg-blue-50 text-blue-700',
  }

  return (
    <aside
      className="absolute inset-y-0 right-0 flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[-24px_0_48px_rgba(15,23,42,0.12)]"
      style={{ width: `${width}px`, zIndex: zIndex.conversationPanel }}
    >
      <div
        className="absolute left-0 top-0 h-full w-3 -translate-x-2 cursor-ew-resize touch-none"
        onPointerDown={handleResizeStart}
        aria-label="Resize conversation panel"
      />

      <ConversationPanelHeader
        topic={node.title}
        conclusion={getNodeConclusion(messages)}
        isFullscreen={isFullscreen}
        onToggleFullScreen={onToggleFullScreen}
        onClose={onClose}
        showMergeButton={!isRootNode && !isMerged}
        isMergeInitiating={isMergeInitiating}
        isProposalPending={hasPendingProposal}
        onInitiateMerge={() => {
          setMergeStatusLabel('Generating merge proposal')
          initiateNodeMergeMutation.mutate({ nodeId: node.id })
        }}
        onCancelMerge={() => {
          setMergeStatusLabel('Cancelling merge')
          cancelMergeMutation.mutate({ nodeId: node.id })
        }}
      />
      <ConversationMessageList
        nodeId={node.id}
        messages={messages}
        inheritedMessages={conversationView.inheritedMessages}
        branchEventMessage={conversationView.branchEventMessage}
        branchSummaryLabel={conversationView.branchSummaryLabel}
        conversationModel={conversationModel}
        isLoading={conversation.isLoadingMessages}
        errorMessage={conversation.messagesLoadError}
        inheritedErrorMessage={conversationView.inheritedMessagesLoadError}
        pendingMessageIds={conversation.pendingMessageIds}
        failedMessageIds={conversation.failedMessageIds}
        onRetryFailedMessage={conversation.retryFailedMessage}
        onDismissFailedMessage={conversation.dismissFailedMessage}
        onBranchFollowupCreated={onOpenBranchConversation}
        onNodeIsMerged={onNodeIsMerged}
        onMergeActionPending={onMergeActionPending}
        onMergeActionSettled={onMergeActionSettled}
        conversationScrollRef={conversationScrollRef}
        bottomAnchorRef={conversationBottomAnchorRef}
      />
      {activeStatusEntry ? (
        <p
          role="status"
          className={`m-0 shrink-0 border-t px-4 py-2 text-xs ${statusBarClass[activeStatusEntry.severity]}`}
        >
          {activeStatusEntry.message}
        </p>
      ) : null}
      {runtimeSummary ? (
        <details className="shrink-0 border-t border-slate-200 bg-slate-50">
          <summary className="cursor-pointer px-4 py-1.5 text-[11px] text-slate-500 transition-colors duration-150 hover:bg-slate-100">
            Runtime
          </summary>
          <p className="m-0 px-4 pb-2 text-[11px] text-slate-500">{runtimeSummary}</p>
        </details>
      ) : null}
      {!isMerged ? (
        <ConversationComposer
          conversationModel={conversationModel}
          setConversationModel={setConversationModel}
          conversationInputText={conversationInputText}
          onConversationInputChange={setConversationInputText}
          onInputResize={adjustConversationInputHeight}
          onConversationKeyDown={handleConversationKeyDown}
          onConversationSubmit={handleConversationSubmit}
          conversationInputRef={conversationInputRef}
        />
      ) : null}
    </aside>
  )
}
