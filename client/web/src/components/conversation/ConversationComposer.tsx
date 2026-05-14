import { type KeyboardEvent, type RefObject, type SubmitEvent } from "react";

export const CHAT_INPUT_MIN_HEIGHT = 24;
export const CHAT_INPUT_MAX_LINES = 10;
export const CHAT_INPUT_MAX_HEIGHT =
  CHAT_INPUT_MIN_HEIGHT * CHAT_INPUT_MAX_LINES;
export const CHAT_MODELS = ["gpt-5", "gpt-4o", "gpt-4.1", "gpt-4"];

type ConversationComposerProps = {
  conversationModel: string;
  setConversationModel: (nextModel: string) => void;
  conversationInputText: string;
  onConversationInputChange: (nextValue: string) => void;
  onInputResize: () => void;
  onConversationKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onConversationSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  conversationInputRef: RefObject<HTMLTextAreaElement | null>;
};

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
  // Model picker UI is intentionally disabled for initial plumbing.
  // Keep these references to preserve wiring and satisfy strict TS no-unused checks.
  void conversationModel;
  void setConversationModel;

  return (
    <form
      className="shrink-0 border-t border-slate-200 bg-white px-4 py-3"
      onSubmit={onConversationSubmit}
    >
      {/*
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
      */}

      <div className="flex items-end gap-2">
        <textarea
          ref={conversationInputRef}
          value={conversationInputText}
          onChange={(event) => onConversationInputChange(event.target.value)}
          onInput={onInputResize}
          onKeyDown={onConversationKeyDown}
          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-900 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
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
          className="h-9 rounded-lg border border-slate-950 bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
          disabled={!conversationInputText.trim().length}
        >
          Send
        </button>
      </div>
    </form>
  );
};
