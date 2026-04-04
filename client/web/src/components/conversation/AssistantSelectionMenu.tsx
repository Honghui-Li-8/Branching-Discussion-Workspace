type AssistantSelectionMenuProps = {
  selectedText: string
  onConfirmSelection: () => void
  onCancelSelection: () => void
}

export const AssistantSelectionMenu = ({
  selectedText,
  onConfirmSelection,
  onCancelSelection,
}: AssistantSelectionMenuProps) => {
  const trimmedSelection = selectedText.trim()

  return (
    <div className="max-w-[360px] rounded-xl border border-[#b9d6e8] bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#487089]">
        Selected text
      </p>
      <p className="mt-2 mb-0 max-h-28 overflow-y-auto rounded-md bg-[#f3f9fd] px-2 py-1.5 text-xs leading-relaxed text-[#244f67]">
        {trimmedSelection || 'No selectable text detected.'}
      </p>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancelSelection}
          className="rounded-md border border-[#b9d6e8] bg-white px-2.5 py-1 text-xs font-medium text-[#3d667f] transition-colors hover:bg-[#f4f9fc]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirmSelection}
          className="rounded-md border border-[#7fb2cf] bg-[#dff0fa] px-2.5 py-1 text-xs font-semibold text-[#22516c] transition-colors hover:bg-[#d2e9f6]"
        >
          Mark Branch
        </button>
      </div>
    </div>
  )
}
