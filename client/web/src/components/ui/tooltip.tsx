import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  style,
  ...props
}: TooltipPrimitive.TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'rounded-md border border-border-strong bg-text-default px-2 py-1 text-caption text-white shadow-sm',
          'data-[state=delayed-open]:[animation:a05a-overlay-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          className,
        )}
        style={{ zIndex: zIndex.popoverMenu, ...style }}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

/** Wraps TooltipProvider with the token-decided hover-open delay (150ms). */
export function AppTooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={150} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  )
}
