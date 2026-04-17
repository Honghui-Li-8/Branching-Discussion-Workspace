import {
  type KeyboardEvent,
  type SubmitEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { zIndex } from '../theme/zIndex'
import type { TreeMessage, TreeNode } from '../types/tree'
import { useAppSelector } from '../store/hooks'
import { selectAuthUser } from '../store/slices/authSlice'
import { useNodeConversation } from './discussion-tree/hooks/useNodeConversation'
import type { TurnStage } from './discussion-tree/hooks/conversationStreamState'
import type { BranchFollowupBootstrap } from './discussion-tree/hooks/useDiscussionTreeUiState'
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
  const [conversationModel, setConversationModel] = useState(CHAT_MODELS[0])
  const conversation = useNodeConversation({
    nodeId: node.id,
    canSendMessages: Boolean(authUser?.id),
    conversationModel,
    branchFollowupBootstrap,
  })
  const [conversationInputText, setConversationInputText] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [sendBlockAlert, setSendBlockAlert] = useState<string | null>(null)

  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
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

  const messages = conversation.messages
  const lastMessageContent = messages[messages.length - 1]?.content ?? ''
  const hasFailedMessages = conversation.failedMessageIds.size > 0
  const streamStatusLabel = conversation.streamStatusLabel
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
  }, [node.id])

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

  return (
    <aside
      className="absolute inset-y-0 right-0 z-[80] flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-[#8bb8cd] bg-[#fefefe] shadow-[-20px_0_38px_rgba(22,57,74,0.12)]"
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
      />
      <ConversationMessageList
        messages={messages}
        conversationModel={conversationModel}
        isLoading={conversation.isLoadingMessages}
        errorMessage={conversation.messagesLoadError}
        pendingMessageIds={conversation.pendingMessageIds}
        failedMessageIds={conversation.failedMessageIds}
        onRetryFailedMessage={conversation.retryFailedMessage}
        onDismissFailedMessage={conversation.dismissFailedMessage}
        onBranchFollowupCreated={onOpenBranchConversation}
        conversationScrollRef={conversationScrollRef}
        bottomAnchorRef={conversationBottomAnchorRef}
      />
      {streamStatusWithElapsed ? (
        <p className="m-0 shrink-0 border-t border-[#d8ebf6] bg-[#f4fbff] px-4 py-2 text-xs text-[#2f6688]">
          {streamStatusWithElapsed}
        </p>
      ) : null}
      {!hasActiveStreamStatus && runtimeSummary ? (
        <p className="m-0 shrink-0 border-t border-[#d8ebf6] bg-[#f8fcff] px-4 py-2 text-[11px] text-[#4d7086]">
          Runtime: {runtimeSummary}
        </p>
      ) : null}
      {sendBlockAlert ? (
        <p
          role="alert"
          className="m-0 shrink-0 border-t border-[#f1cabd] bg-[#fff6f3] px-4 py-2 text-xs text-[#8a3f2b]"
        >
          {sendBlockAlert}
        </p>
      ) : null}
      {conversation.messageSendError && !hasFailedMessages ? (
        <p className="m-0 shrink-0 border-t border-[#f1cabd] bg-[#fff6f3] px-4 py-2 text-xs text-[#8a3f2b]">
          Failed to send message: {conversation.messageSendError}
        </p>
      ) : null}
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
    </aside>
  )
}
