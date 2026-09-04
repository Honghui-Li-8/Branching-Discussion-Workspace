import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'

// A04a's verdict: Radix, "way better than MUI's hand-rolled version."
// Distinct from Tooltip (short text label, opens fast, no interactive
// content) and from Popover (click-triggered, focus-trapping): HoverCard is
// hover-triggered rich content the pointer can move into. Plausible fit for
// a tree-node preview on hover, but no confirmed consumer today.

export const HoverCard = HoverCardPrimitive.Root
export const HoverCardTrigger = HoverCardPrimitive.Trigger

export function HoverCardContent({
  className,
  sideOffset = 6,
  style,
  ...props
}: HoverCardPrimitive.HoverCardContentProps) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'w-64 rounded-md border border-border-default bg-bg-default p-3 text-label text-text-secondary shadow-md',
          'data-[state=open]:[animation:a05a-overlay-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-overlay-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
          className,
        )}
        style={{ zIndex: zIndex.popoverMenu, ...style }}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}
