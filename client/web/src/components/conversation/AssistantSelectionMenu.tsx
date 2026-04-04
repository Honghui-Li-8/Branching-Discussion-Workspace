type AssistantSelectionMenuProps = {
  selectedText: string
  onConfirmSelection: () => void
  onSuggestSelection: () => void
  onDismissSelection: () => void
}

export const AssistantSelectionMenu = ({
  selectedText,
  onConfirmSelection,
  onSuggestSelection,
  onDismissSelection,
}: AssistantSelectionMenuProps) => {
  const trimmedSelection = selectedText.trim()

  return (
    <div className="relative max-w-[360px] rounded-xl border border-[#b9d6e8] bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      <button
        type="button"
        aria-label="Dismiss selection menu"
        onClick={onDismissSelection}
        className="absolute top-1.5 right-2 px-1 text-[18px] font-semibold leading-none text-[#d89a9a] transition-colors hover:text-[#cc7a7a]"
      >
        ×
      </button>

      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#487089]">
        Selected text
      </p>
      <p className="mt-2 mb-0 max-h-28 overflow-y-auto rounded-md bg-[#f3f9fd] px-2 py-1.5 text-xs leading-relaxed text-[#244f67]">
        {trimmedSelection || 'No selectable text detected.'}
      </p>

      <div className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onSuggestSelection}
          className="rounded-md border border-[#f1e3b3] bg-[#fff7dc] px-2 py-0.5 text-[11px] font-semibold text-[#7b5d14] whitespace-nowrap transition-colors hover:bg-[#fef0c2]"
        >
          Suggest
        </button>
        <button
          type="button"
          onClick={onConfirmSelection}
          className="rounded-md border border-[#7fb2cf] bg-[#dff0fa] px-2 py-0.5 text-[11px] font-semibold text-[#22516c] whitespace-nowrap transition-colors hover:bg-[#d2e9f6]"
        >
          Branch
        </button>
      </div>
    </div>
  )
}
