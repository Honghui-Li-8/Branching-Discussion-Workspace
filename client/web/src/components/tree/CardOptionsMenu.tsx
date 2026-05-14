import { useEffect, useRef } from 'react'
import { zIndex } from '../../theme/zIndex'

type CardOptionsMenuProps = {
  canCollapse: boolean
  isOpen: boolean
  onOpenChange: (nextOpen: boolean) => void
  onCollapse: () => void
}

export const CardOptionsMenu = ({
  canCollapse,
  isOpen,
  onOpenChange,
  onCollapse,
}: CardOptionsMenuProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return
      }

      onOpenChange(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen, onOpenChange])

  return (
    <div
      ref={rootRef}
      className="absolute right-2 top-0"
      style={{ zIndex: zIndex.inlineControls }}
    >
      <button
        type="button"
        className="inline-flex h-6 w-7 items-center justify-center rounded-md text-sm font-semibold tracking-wide text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Card options"
        onClick={() => onOpenChange(!isOpen)}
      >
        ...
      </button>

      {isOpen ? (
        <div
          className="absolute bottom-0 left-full h-12 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]"
          style={{ zIndex: zIndex.popoverMenu }}
        >
          <button
            type="button"
            className="flex h-full w-full items-center px-3 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            onClick={() => {
              if (!canCollapse) {
                return
              }

              onCollapse()
              onOpenChange(false)
            }}
            disabled={!canCollapse}
          >
            Collapse
          </button>
        </div>
      ) : null}
    </div>
  )
}
