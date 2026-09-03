import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react' // not yet in A05b's icons.ts map — flagged, this is a real usage not covered there
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'
import { ALERT_TONE_STYLES, type AlertTone } from './alert-banner'

// Combines what "Alert" and "Toast" were separately trying to be into one
// imperative, portal-based popup system — the standard clean replacement
// for the browser's native window.alert()/confirm() (blocking, unstyled,
// can't be positioned or auto-dismissed). Call useAlertPopup().show(...)
// from anywhere under the Provider; nothing needs to be pre-rendered
// inline the way the old static Toast did.
//
// Analysis on combine-vs-separate (asked by the owner): combine. The only
// real differences between an "alert" and a "toast" are behavioral
// (auto-dismiss vs. persistent, default position) — not visual. Modeling
// that as parameters on one component is simpler than two nearly-
// identical trees. AlertBanner (the static, in-page, persistent version
// matching the Figma reference literally) is unchanged and separate —
// this is specifically the popup/imperative invocation mode.
//
// Uses framer-motion (added this round) for exit animation + automatic
// layout reflow when a popup is removed from a stack — plain CSS can
// animate one element's own enter/exit, but animating its *siblings*
// smoothly sliding into the vacated space needs FLIP-style measurement,
// which framer-motion's AnimatePresence + layout handles correctly.
// Not part of A04a's originally validated package list — a real new
// dependency, flagged rather than added silently; worth a deliberate
// call (keep vs. hand-roll FLIP) when this gets re-applied for real.

export type PopupPosition = 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right'
export type PopupVariant = 'stripe-dot' | 'stripe-only' | 'dot-only'
/** 'drain' (full -> empty, default — owner's pick after comparing both) or
 *  'fill' (empty -> full) — kept as a real comparable option, not removed
 *  now that one's the default; a quick A/B is still cheap to re-run. */
export type ProgressDirection = 'fill' | 'drain'

// Deck/stacked layout (Sonner-style collapsed card deck) was prototyped here
// and removed on the owner's call: the effect is hard to match faithfully and
// not worth the complexity for this app's volume of notifications. If stacked
// toasts are ever wanted, the decision was to reach for Sonner directly as a
// separate surface rather than reimplement its behavior inside this
// component. Popups always lay out as a plain column.

export type AlertPopupOptions = {
  tone: AlertTone
  /** Optional — omit for a compact, body-only message (still color-coded
   *  via the stripe/dot and text color), no separate bold headline. */
  title?: string
  description: string
  /** Default 'top-center'. */
  position?: PopupPosition
  /** ms until auto-dismiss. null = persistent, manual close only. Default 4000. */
  duration?: number | null
  /** Default 'dot-only' — the owner's feedback was the full stripe+dot
   *  combo reads too heavy for a small transient popup. */
  variant?: PopupVariant
  /** Default 'drain'. */
  progressDirection?: ProgressDirection
  /** 0-1. Default 0.4. The first pass hardcoded a 20%-opacity Tailwind
   *  class (0.2) — flagged as too transparent; this is now a genuine
   *  continuous runtime value, not a swap between a couple of fixed
   *  presets. */
  progressOpacity?: number
}

type ActivePopup = Required<Omit<AlertPopupOptions, 'duration' | 'title'>> & {
  id: number
  title: string | undefined
  duration: number | null
}

const POSITION_CLASSES: Record<PopupPosition, string> = {
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-4 right-4 items-end',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
}

const POSITIONS: PopupPosition[] = ['top-center', 'top-right', 'bottom-center', 'bottom-right']

// Slide up + fade, both directions, exactly as requested — enter starts
// 8px below its resting spot and rises in; exit continues rising while
// fading out, rather than reversing back down.
const cardMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}
// framer-motion's transitions are JS-driven (seconds), can't reference the
// app's --duration-overlay CSS custom property directly — 0.2s mirrors its
// current value (200ms) by hand instead.
const cardTransition = { duration: 0.2, ease: [0.2, 0.7, 0.2, 1] as const }

const AlertPopupContext = createContext<{ show: (options: AlertPopupOptions) => void } | null>(null)

export function useAlertPopup() {
  const ctx = useContext(AlertPopupContext)
  if (!ctx) throw new Error('useAlertPopup must be used within <AlertPopupProvider>')
  return ctx
}

function PopupCard({ popup, onClose }: { popup: ActivePopup; onClose: () => void }) {
  const styles = ALERT_TONE_STYLES[popup.tone]
  const hasStripe = popup.variant !== 'dot-only'
  const hasDot = popup.variant !== 'stripe-only'
  const hasTitle = popup.title !== undefined

  return (
    <motion.div
      layout
      initial={cardMotion.initial}
      animate={cardMotion.animate}
      exit={cardMotion.exit}
      transition={cardTransition}
      role={popup.tone === 'error' ? 'alert' : 'status'}
      className={cn(
        // NOT w-fit: on a position:fixed element, w-fit resolves to
        // min-content, which collapsed the card to ~130px and wrapped a
        // short one-line message across 3 lines (the exact "too tall"
        // symptom). w-max sizes to the text's natural single-line width,
        // with max-w-md as the wrap cap for genuinely long copy — so
        // height stays at one or two lines, not three.
        // items-center on the outer row keeps the close button from
        // adding height; the dot pairs with the title in its own row so
        // its alignment matches AlertBanner exactly.
        'relative flex w-max max-w-md items-center gap-2 overflow-hidden rounded-lg border bg-bg-default py-1.5 pl-3 pr-1.5 shadow-md',
        hasStripe ? cn('border-l-4', styles.border, styles.stripe) : styles.border,
      )}
    >
      <div className="min-w-0 flex-1">
        {hasTitle ? (
          <>
            <div className="flex items-center gap-2">
              {hasDot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} aria-hidden="true" />}
              <span className={cn('text-label font-semibold', styles.title)}>{popup.title}</span>
            </div>
            <p className="text-label leading-tight text-text-secondary">{popup.description}</p>
          </>
        ) : (
          <div className="flex items-center gap-2">
            {hasDot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} aria-hidden="true" />}
            <p className={cn('text-label font-medium leading-tight', styles.title)}>{popup.description}</p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 self-center rounded p-1 text-text-muted hover:bg-bg-subtle"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {popup.duration !== null && (
        <span
          // Inline color+opacity, not a Tailwind class — opacity here is a
          // genuinely continuous runtime number (progressOpacity), and
          // Tailwind's `/N` opacity modifier only accepts a fixed, ahead-
          // of-time-compiled set of values, not an arbitrary slider input.
          // Direction (fill empty->full, or drain full->empty) is a real
          // comparable option, not removed now that drain is the default
          // — see ProgressDirection.
          className="absolute bottom-0 left-0 h-0.5 w-full origin-left"
          style={{
            backgroundColor: styles.raw,
            opacity: popup.progressOpacity,
            animation: `${popup.progressDirection === 'drain' ? 'a05a-countdown-drain' : 'a05a-countdown-fill'} ${popup.duration}ms linear forwards`,
          }}
          aria-hidden="true"
        />
      )}
    </motion.div>
  )
}

export function AlertPopupProvider({ children }: { children: React.ReactNode }) {
  const [popups, setPopups] = useState<ActivePopup[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setPopups((current) => current.filter((p) => p.id !== id))
  }, [])

  const show = useCallback(
    (options: AlertPopupOptions) => {
      const id = ++idRef.current
      const popup: ActivePopup = {
        id,
        tone: options.tone,
        title: options.title,
        description: options.description,
        position: options.position ?? 'top-center',
        duration: options.duration === undefined ? 4000 : options.duration,
        variant: options.variant ?? 'dot-only',
        progressDirection: options.progressDirection ?? 'drain',
        progressOpacity: options.progressOpacity ?? 0.4,
      }
      setPopups((current) => [...current, popup])
      if (popup.duration !== null) {
        window.setTimeout(() => dismiss(id), popup.duration)
      }
    },
    [dismiss],
  )

  return (
    <AlertPopupContext.Provider value={{ show }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {POSITIONS.map((position) => {
              // Always render the wrapper + AnimatePresence, even with zero
              // current popups at this position — conditionally unmounting
              // it based on count was the bug: when the *last* popup at a
              // position was dismissed, this wrapper (and the
              // AnimatePresence inside it) disappeared in the same render
              // as the removal, which skips AnimatePresence's exit-delay
              // mechanism entirely. An always-mounted empty wrapper is
              // harmless (zero-size, no visible/interactive footprint).
              const atPosition = popups.filter((p) => p.position === position)
              return (
                <div
                  key={position}
                  className={cn('fixed flex flex-col gap-2', POSITION_CLASSES[position])}
                  style={{ zIndex: zIndex.dialog + 10 }}
                >
                  <AnimatePresence mode="popLayout">
                    {atPosition.map((p) => (
                      <PopupCard key={p.id} popup={p} onClose={() => dismiss(p.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              )
            })}
          </>,
          document.body,
        )}
    </AlertPopupContext.Provider>
  )
}
