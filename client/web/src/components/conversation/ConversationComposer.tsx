import { type KeyboardEvent, type RefObject, type SubmitEvent } from 'react'

export const CHAT_INPUT_MIN_HEIGHT = 24
export const CHAT_INPUT_MAX_LINES = 10
export const CHAT_INPUT_MAX_HEIGHT = CHAT_INPUT_MIN_HEIGHT * CHAT_INPUT_MAX_LINES
export const CHAT_MODELS = ['gpt-5', 'gpt-4o', 'gpt-4.1', 'gpt-4']

type ConversationComposerProps = {
  conversationModel: string
  setConversationModel: (nextModel: string) => void
  conversationInputText: string
  onConversationInputChange: (nextValue: string) => void
  onInputResize: () => void
  onConversationKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onConversationSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  conversationInputRef: RefObject<HTMLTextAreaElement | null>
}

export const ConversationComposer = ({
  conversationModel,
  setConversationModel,
  conversationInputText,
  onConversationInputChange,
  onInputResize,
  onConversationKeyDown,
  onConversationSubmit,
  conversationInputRef,
}: ConversationComposerProps) => {
  return (
    <form className="border-t border-[#c2dfef] bg-white px-4 py-3" onSubmit={onConversationSubmit}>
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
          onChange={(event) => onConversationInputChange(event.target.value)}
          onInput={onInputResize}
          onKeyDown={onConversationKeyDown}
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
  )
}
