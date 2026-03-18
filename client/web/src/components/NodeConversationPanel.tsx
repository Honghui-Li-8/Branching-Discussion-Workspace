import {
  FormEvent,
  KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { zIndex } from '../theme/zIndex'
import type { TreeMessage, TreeNode } from '../types/tree'

const CHAT_INPUT_MIN_HEIGHT = 24
const CHAT_INPUT_MAX_LINES = 10
const CHAT_INPUT_MAX_HEIGHT = CHAT_INPUT_MIN_HEIGHT * CHAT_INPUT_MAX_LINES
const CHAT_MODELS = ['gpt-5', 'gpt-4o', 'gpt-4.1', 'gpt-4']

type NodeConversationPanelProps = {
  node: TreeNode
  width: number
  isFullscreen: boolean
  onClose: () => void
  onSendMessage: (message: string) => void
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

export const NodeConversationPanel = ({
  node,
  width,
  isFullscreen,
  onClose,
  onSendMessage,
  onWidthChange,
  onToggleFullScreen,
}: NodeConversationPanelProps) => {
  const [conversationInputText, setConversationInputText] = useState('')
  const [conversationModel, setConversationModel] = useState(CHAT_MODELS[0])
  const [isResizing, setIsResizing] = useState(false)

  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const conversationScrollRef = useRef<HTMLDivElement | null>(null)
  const conversationInputRef = useRef<HTMLTextAreaElement | null>(null)

  const messages = node.messages ?? []

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
    setConversationInputText('')
    if (conversationInputRef.current) {
      conversationInputRef.current.style.height = `${CHAT_INPUT_MIN_HEIGHT}px`
      conversationInputRef.current.style.overflowY = 'hidden'
    }
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

  const handleResizeStart = (event: PointerEvent<HTMLDivElement>) => {
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

    onSendMessage(text)
    setConversationInputText('')

    if (conversationInputRef.current) {
      conversationInputRef.current.style.height = `${CHAT_INPUT_MIN_HEIGHT}px`
      conversationInputRef.current.style.overflowY = 'hidden'
    }
  }

  const handleConversationSubmit = (event: FormEvent<HTMLFormElement>) => {
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

      <header className="relative border-b border-[#c2dfef] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2">
            <button
              type="button"
              className="mt-1 inline-flex items-center justify-center text-[#2b6382] hover:text-[#1a4f69]"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={onToggleFullScreen}
              aria-label="Toggle fullscreen conversation panel"
            >
                <span className="sr-only">
                {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              </span>
              {isFullscreen ? (
                <CloseFullscreenIcon fontSize="inherit" className="-scale-x-100" />
              ) : (
                <OpenInFullIcon fontSize="inherit" className="-scale-x-100" />
              )}
            </button>
            <div className="min-w-0">
              <p className="m-0 text-[11px] uppercase tracking-[0.1em] text-[#2f6f8e]">Topic</p>
              <h2
                className="mt-0.5 text-base font-medium leading-tight text-[#12384c]"
                style={{ overflowWrap: 'anywhere' }}
              >
                {node.title}
              </h2>
            </div>
          </div>
          <p className="m-0 min-w-0 max-w-[220px] text-right text-[11px] leading-tight text-[#2f6f8e]">
            {getNodeConclusion(messages)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-[#b8d9ee] px-2 py-1 text-xs text-[#2b6382] hover:bg-[#eef9ff]"
              onClick={onClose}
              aria-label="Close conversation"
            >
              Close
            </button>
          </div>
        </div>
      </header>

      <div
        ref={conversationScrollRef}
        className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fdfefe_0%,#f8fdff_100%)] px-4 py-3"
        style={{ minHeight: 0 }}
      >
        <div className="flex min-h-full flex-col justify-end gap-2">
          {messages.length ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-[14px] px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-[#e8f4fd] text-[#12384c]'
                      : 'border border-[#b5deef] bg-white text-[#1f4f68]'
                  }`}
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {message.content}
                </div>
              </div>
            ))
          ) : (
            <p className="m-0 self-stretch rounded-lg border border-dashed border-[#bdd7eb] bg-white p-3 text-sm text-[#40657d]">
              No messages yet for this node. Start with your first thought below.
            </p>
          )}
        </div>
      </div>

      <form className="border-t border-[#c2dfef] bg-white px-4 py-3" onSubmit={handleConversationSubmit}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-[#2a6082]" htmlFor="chat-model">
            Model
            <select
              id="chat-model"
              className="rounded border border-[#9dc6dd] bg-white px-2 py-1 text-sm text-[#1e546f]"
              value={conversationModel}
              onChange={(event) => setConversationModel(event.target.value)}
            >
              {CHAT_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <span className="text-[11px] text-[#5f89a1]">Model: {conversationModel}</span>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={conversationInputRef}
            value={conversationInputText}
            onChange={(event) => {
              setConversationInputText(event.target.value)
            }}
            onInput={adjustConversationInputHeight}
            onKeyDown={handleConversationKeyDown}
            className="w-full resize-none rounded-lg border border-[#a7d2e8] bg-white px-3 py-2 text-sm leading-6 text-[#12384c] focus:border-[#5da8d2] focus:outline-none"
            placeholder="Message..."
            rows={1}
            style={{
              minHeight: `${CHAT_INPUT_MIN_HEIGHT}px`,
              maxHeight: `${CHAT_INPUT_MAX_HEIGHT}px`,
              lineHeight: `${CHAT_INPUT_MIN_HEIGHT}px`,
            }}
          />
          <button
            type="submit"
            className="h-9 rounded-lg border border-[#5a92ba] bg-gradient-to-b from-[#6db6e2] to-[#4ea2d3] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(46,111,156,0.2)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!conversationInputText.trim().length}
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  )
}
