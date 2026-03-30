import {
  type KeyboardEvent,
  type SubmitEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { zIndex } from '../theme/zIndex'
import type { TreeMessage, TreeNode } from '../types/tree'
import { useAppSelector } from '../store/hooks'
import { selectAuthUser } from '../store/slices/authSlice'
import { useNodeConversation } from './discussion-tree/hooks/useNodeConversation'
import { ConversationComposer, CHAT_INPUT_MAX_HEIGHT, CHAT_INPUT_MIN_HEIGHT, CHAT_MODELS } from './conversation/ConversationComposer'
import { ConversationMessageList } from './conversation/ConversationMessageList'
import { ConversationPanelHeader } from './conversation/ConversationPanelHeader'

type NodeConversationPanelProps = {
  node: TreeNode
  width: number
  isFullscreen: boolean
  onClose: () => void
  onWidthChange: (nextWidth: number) => void
  onToggleFullScreen: () => void
}

const getNodeConclusion = (messages: TreeMessage[] | undefined) => {
  if (!messages || messages.length === 0) {
    return 'No conclusion yet.'
  }

  const lastMessage = [...messages].reverse().find((message) => message.role === 'assistant')
  return lastMessage?.content ?? messages[messages.length - 1].content
}

/**
 * Conversation side panel for a selected tree node.
 * Renders node messages, input composer, and resize/fullscreen controls.
 */
export const NodeConversationPanel = ({
  node,
  width,
  isFullscreen,
  onClose,
  onWidthChange,
  onToggleFullScreen,
}: NodeConversationPanelProps) => {
  const authUser = useAppSelector(selectAuthUser)
  const conversation = useNodeConversation({
    nodeId: node.id,
    canSendMessages: Boolean(authUser?.id),
  })
  const [conversationInputText, setConversationInputText] = useState('')
  const [conversationModel, setConversationModel] = useState(CHAT_MODELS[0])
  const [isResizing, setIsResizing] = useState(false)
  const [sendBlockAlert, setSendBlockAlert] = useState<string | null>(null)

  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const conversationScrollRef = useRef<HTMLDivElement | null>(null)
  const conversationInputRef = useRef<HTMLTextAreaElement | null>(null)

  const messages = conversation.messages
  const hasFailedMessages = conversation.failedMessageIds.size > 0

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
    setSendBlockAlert(null)
  }, [node.id])

  useEffect(() => {
    if (!conversationScrollRef.current) {
      return
    }

    conversationScrollRef.current.scrollTo({
      top: conversationScrollRef.current.scrollHeight,
      behavior: 'auto',
    })
  }, [node.id, messages.length])

  useEffect(() => {
    adjustConversationInputHeight()
  }, [conversationInputText])

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

  return (
    <aside
      className="absolute inset-y-0 right-0 z-[80] flex w-full flex-col border-l border-[#8bb8cd] bg-[#fefefe] shadow-[-20px_0_38px_rgba(22,57,74,0.12)]"
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
        isLoading={conversation.isLoadingMessages}
        errorMessage={conversation.messagesLoadError}
        pendingMessageIds={conversation.pendingMessageIds}
        failedMessageIds={conversation.failedMessageIds}
        onRetryFailedMessage={conversation.retryFailedMessage}
        onDismissFailedMessage={conversation.dismissFailedMessage}
        conversationScrollRef={conversationScrollRef}
      />
      {sendBlockAlert ? (
        <p
          role="alert"
          className="m-0 border-t border-[#f1cabd] bg-[#fff6f3] px-4 py-2 text-xs text-[#8a3f2b]"
        >
          {sendBlockAlert}
        </p>
      ) : null}
      {conversation.messageSendError && !hasFailedMessages ? (
        <p className="m-0 border-t border-[#f1cabd] bg-[#fff6f3] px-4 py-2 text-xs text-[#8a3f2b]">
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
