import { type KeyboardEvent, type RefObject, type SubmitEvent } from "react";
import { CHAT_INPUT_MIN_HEIGHT, CHAT_INPUT_MAX_HEIGHT } from "./conversationComposerConstants";
import { Button } from "../ui/button";


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
      className="shrink-0 border-t border-border-default bg-bg-default px-4 py-3"
      onSubmit={onConversationSubmit}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={conversationInputRef}
          value={conversationInputText}
          onChange={(event) => onConversationInputChange(event.target.value)}
          onInput={onInputResize}
          onKeyDown={onConversationKeyDown}
          aria-label="Message"
          className="w-full resize-none rounded-md border border-border-default bg-bg-subtle px-3 py-2 text-body text-text-default transition-colors focus:border-accent-default focus:bg-bg-default focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2"
          placeholder="Message..."
          rows={1}
          style={{
            minHeight: `${CHAT_INPUT_MIN_HEIGHT}px`,
            maxHeight: `${CHAT_INPUT_MAX_HEIGHT}px`,
            lineHeight: `${CHAT_INPUT_MIN_HEIGHT}px`,
          }}
        />
        <Button type="submit" size="sm" disabled={!conversationInputText.trim().length}>
          Send
        </Button>
      </div>
    </form>
  );
};
