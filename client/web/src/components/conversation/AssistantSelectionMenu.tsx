import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'

// ── Hardcoded suggestions (placeholder — replace with computed suggestions) ──
const BRANCH_SUGGESTIONS = [
  'What are the implications of this?',
  'Can you give a concrete example?',
  'How does this compare to alternatives?',
]

// ── Hint text (commented out — section hidden) ───────────────────────────────
// const HINT_ENTRIES: Array<{ minWidth: number; text: string }> = [
//   { minWidth: 0,   text: 'Expand' },
//   { minWidth: 120, text: 'Dig deeper' },
//   { minWidth: 180, text: 'Ask a follow-up' },
//   { minWidth: 240, text: 'Explore this further' },
//   { minWidth: 320, text: 'What would you like to explore?' },
//   { minWidth: 400, text: 'Ask a follow-up to branch from this selection' },
// ]
// const selectHintText = (widthPx: number): string => {
//   const eligible = HINT_ENTRIES.filter(({ minWidth }) => widthPx >= minWidth).map(({ text }) => text)
//   const pool = eligible.length > 0 ? eligible : [HINT_ENTRIES[0]!.text]
//   return pool[Math.floor(Math.random() * pool.length)]!
// }
// const TYPEWRITER_CHAR_MS = 38
// const useTypewriter = (fullText: string): string => {
//   const [displayed, setDisplayed] = useState('')
//   useEffect(() => {
//     setDisplayed('')
//     if (!fullText) return
//     let i = 0
//     const step = () => { i += 1; setDisplayed(fullText.slice(0, i)); if (i < fullText.length) setTimeout(step, TYPEWRITER_CHAR_MS) }
//     const timer = setTimeout(step, TYPEWRITER_CHAR_MS)
//     return () => clearTimeout(timer)
//   }, [fullText])
//   return displayed
// }


// ── AutoResizeTextarea ────────────────────────────────────────────────────────
const TEXTAREA_LINE_HEIGHT_PX = 20
const TEXTAREA_MAX_LINES = 5
const TEXTAREA_MAX_HEIGHT_PX = TEXTAREA_LINE_HEIGHT_PX * TEXTAREA_MAX_LINES

type AutoResizeTextareaProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const AutoResizeTextarea = ({ value, onChange, placeholder }: AutoResizeTextareaProps) => {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const adjust = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT_PX ? 'auto' : 'hidden'
  }

  useEffect(() => { adjust() }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={adjust}
      placeholder={placeholder}
      rows={1}
      className="w-full resize-none bg-transparent px-1 py-1 text-sm text-[#12384c] focus:outline-none placeholder:text-[#8bb5cc]"
      style={{
        lineHeight: `${TEXTAREA_LINE_HEIGHT_PX}px`,
        minHeight: `${TEXTAREA_LINE_HEIGHT_PX}px`,
        maxHeight: `${TEXTAREA_MAX_HEIGHT_PX}px`,
      }}
    />
  )
}

// ── useLongPress ──────────────────────────────────────────────────────────────
// NOTE: Temporary feature — remove this hook when long-press branch UX is replaced.
//
// Action is always decided on RELEASE, never on timeout:
//   < 2 s  → onClick (branch)
//   2–5 s  → onLongPressSuggest
//   ≥ 5 s  → onLongPressDelete
// The progress animation drives visual feedback only; no side-effects fire mid-hold.
const LONG_PRESS_SUGGEST_MS = 2000
const LONG_PRESS_DELETE_MS = 5000

type UseLongPressReturn = {
  longPressMouseDown: (e: MouseEvent<HTMLButtonElement>) => void
  longPressMouseUp: () => void
  longPressMouseLeave: () => void
  longPressProgress: number // 0–1 over the full 5 s duration, for visual feedback
}

const useLongPress = (
  onClick: () => void,
  onLongPressSuggest: () => void,
  onLongPressDelete: () => void,
): UseLongPressReturn => {
  const [longPressProgress, setLongPressProgress] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const cancelRaf = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const reset = () => {
    cancelRaf()
    startTimeRef.current = null
    setLongPressProgress(0)
  }

  const tick = () => {
    if (startTimeRef.current === null) return
    const p = Math.min((Date.now() - startTimeRef.current) / LONG_PRESS_DELETE_MS, 1)
    setLongPressProgress(p)
    if (p < 1) rafRef.current = requestAnimationFrame(tick)
  }

  const longPressMouseDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault() // prevent browser text-selection during hold
    reset()
    startTimeRef.current = Date.now()
    rafRef.current = requestAnimationFrame(tick)
  }

  const longPressMouseUp = () => {
    if (startTimeRef.current === null) {
      reset()
      return
    }
    const elapsed = Date.now() - startTimeRef.current
    reset()

    if (elapsed >= LONG_PRESS_DELETE_MS) {
      onLongPressDelete()
    } else if (elapsed >= LONG_PRESS_SUGGEST_MS) {
      onLongPressSuggest()
    } else {
      onClick()
    }
  }

  return {
    longPressMouseDown,
    longPressMouseUp,
    longPressMouseLeave: reset, // cancel if pointer leaves without releasing
    longPressProgress,
  }
}

// ── Long-press button style (NOTE: temporary — remove with long-press feature) ─
const getLongPressButtonStyle = (progress: number): CSSProperties => {
  if (progress <= 0) return {}
  // 0–40 %: subtle blue fill creep
  if (progress < 0.4) {
    return {
      background: `linear-gradient(to right, rgba(245,158,11,0.25) ${progress * 100}%, #dff0fa ${progress * 100}%)`,
    }
  }
  // 40–80 %: amber (suggest threshold crossed)
  if (progress < 0.8) {
    return { backgroundColor: '#f59e0b', borderColor: '#d97706', color: '#fff' }
  }
  // 80–100 %: red (delete threshold approaching)
  return { backgroundColor: '#ef4444', borderColor: '#dc2626', color: '#fff' }
}

// ── AssistantSelectionMenu ────────────────────────────────────────────────────
type AssistantSelectionMenuProps = {
  selectedText: string
  onBranch: (inputText: string) => void
  onSuggest: (inputText: string) => void
  onDelete: () => void
  onDismiss: () => void
  isBranchActionPending?: boolean
}

export const AssistantSelectionMenu = ({
  selectedText,
  onBranch,
  onSuggest,
  onDelete,
  onDismiss,
  isBranchActionPending = false,
}: AssistantSelectionMenuProps) => {
  const [inputText, setInputText] = useState('')
  // const [hintText, setHintText] = useState(() => selectHintText(440))
  const [containerWidth, setContainerWidth] = useState(560)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // const displayedHint = useTypewriter(hintText)

  // Set hint text once on mount based on initial width
  // useEffect(() => {
  //   const el = containerRef.current
  //   if (!el) return
  //   setHintText(selectHintText(el.offsetWidth))
  // }, [])

  // Track width for suggestion sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.offsetWidth)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w !== undefined) setContainerWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // On mouse release, snap modal back if it overflows the right edge of the screen
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleMouseUp = () => {
      const rect = el.getBoundingClientRect()
      const maxRight = window.innerWidth - 40
      if (rect.right > maxRight) {
        const clampedWidth = maxRight - rect.left
        el.style.width = `${clampedWidth}px`
        setContainerWidth(clampedWidth)
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const handleBranchClick = () => {
    if (isBranchActionPending) return
    console.log('[branch-menu] branch click, input:', inputText)
    onBranch(inputText)
  }

  const handleSuggestLongPress = () => {
    console.log('[branch-menu] long-press suggest (2 s), input:', inputText)
    onSuggest(inputText)
  }

  const handleDeleteLongPress = () => {
    console.log('[branch-menu] long-press delete (5 s)')
    onDelete()
  }

  const { longPressMouseDown, longPressMouseUp, longPressMouseLeave, longPressProgress } =
    useLongPress(handleBranchClick, handleSuggestLongPress, handleDeleteLongPress)

  const handleSuggestionClick = (suggestion: string) => {
    console.log('[branch-menu] suggestion clicked:', suggestion)
    if (inputText.trim()) {
      alert(`Input already has content:\n"${inputText.trim()}"\n\nSuggestion not applied.`)
      return
    }
    setInputText(suggestion)
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-[#b9d6e8] bg-white/95 shadow-lg backdrop-blur-sm"
      style={{ width: '560px', maxWidth: '95vw', minWidth: '320px', resize: 'horizontal', overflow: 'hidden' }}
    >
      {/* × — dismiss only, no deletion (deletion is 5 s long-press on Branch) */}
      <button
        type="button"
        aria-label="Close selection menu"
        onClick={onDismiss}
        className="absolute top-2 right-2.5 z-10 px-1 text-[18px] font-semibold leading-none text-[#d89a9a] transition-colors hover:text-[#cc7a7a]"
      >
        ×
      </button>

      {/* 1. Selected text — read-only, left-border accent as visual quote indicator */}
      <div className="px-4 pt-4 pb-0">
        <div
          className="overflow-y-auto border-l-2 border-[#7fb2cf] bg-[#f3f9fd] px-2.5 py-2 text-xs font-medium italic leading-relaxed text-[#244f67]"
          style={{ maxHeight: '250px' }}
        >
          {selectedText.trim() || 'No text selected.'}
        </div>
      </div>

      {/* Divider — separates context (display) from action area */}
      <div className="mx-4 my-3 h-[2px] rounded-full bg-[#ddeef6]" />

      {/* Action zone — hint + suggestions + input */}
      <div className="px-4 pt-0 pb-4">

        {/* 2. Hint heading — left-aligned, medium weight, introduces the action zone */}
        {/* <p className="m-0 pb-2 text-[12px] font-medium tracking-wide text-[#487089]">
          {displayedHint}
        </p> */}

        {/* 3. Suggestions row — horizontal scroll, narrower than input */}
        <style>{`.sugg-row::-webkit-scrollbar{height:0.5px}.sugg-row::-webkit-scrollbar-track{background:transparent}.sugg-row::-webkit-scrollbar-thumb{background:#b9d6e8;border-radius:9999px}`}</style>
        <div className="sugg-row mx-1 mb-2 flex gap-1.5 overflow-x-auto rounded-md px-2 py-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#b9d6e8 transparent' }}>
          {BRANCH_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              title={suggestion}
              // TODO: Show full suggestion in a tooltip after 1 s hover (deferred)
              className="flex-shrink-0 rounded-md border border-[#d4e9c1] bg-[#edf7e4] px-2 py-0.5 text-left text-[11px] leading-4 text-[#3d6b22] transition-colors hover:bg-[#ddf0d0]"
              style={{
                minWidth: '72px',
                maxWidth: `${containerWidth * 0.4}px`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* 4 + 5. Input area + Branch button inline (send-button layout) */}
        <div className="flex items-end gap-2 rounded-lg border border-[#a7d2e8] bg-white px-2 py-2 transition-colors focus-within:border-[#5da8d2]">
          <AutoResizeTextarea
            value={inputText}
            onChange={setInputText}
            placeholder="Ask a follow-up question to explore this further…"
          />
          {/* Branch button — aligned to bottom of last text line */}
          <button
            type="button"
            disabled={isBranchActionPending}
            onMouseDown={longPressMouseDown}
            onMouseUp={longPressMouseUp}
            onMouseLeave={longPressMouseLeave}
            className="mb-0.5 flex-shrink-0 select-none rounded-md border border-[#7fb2cf] bg-[#dff0fa] px-3 py-1 text-[11px] font-semibold text-[#22516c] transition-colors hover:bg-[#d2e9f6] disabled:cursor-not-allowed disabled:opacity-50"
            style={getLongPressButtonStyle(longPressProgress)}
          >
            {isBranchActionPending ? 'Branching…' : 'Branch'}
          </button>
        </div>

      </div>{/* end action zone */}
    </div>
  )
}
