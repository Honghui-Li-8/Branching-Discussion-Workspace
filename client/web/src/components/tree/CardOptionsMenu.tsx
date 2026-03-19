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
        className="inline-flex h-5 items-center justify-center px-1 text-sm font-semibold tracking-wide text-[#2f6d88] hover:text-[#1d516a]"
        aria-label="Card options"
        onClick={() => onOpenChange(!isOpen)}
      >
        ...
      </button>

      {isOpen ? (
        <div
          className="absolute bottom-0 left-full h-12 w-32 overflow-hidden rounded-lg border border-[#8ab8cd] bg-white shadow-[0_8px_18px_rgba(38,90,114,0.2)]"
          style={{ zIndex: zIndex.popoverMenu }}
        >
          <button
            type="button"
            className="flex h-full w-full items-center px-3 text-left text-xs text-[#1d516a] hover:bg-[#f3fbff] disabled:cursor-not-allowed disabled:text-[#94aeb9]"
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
