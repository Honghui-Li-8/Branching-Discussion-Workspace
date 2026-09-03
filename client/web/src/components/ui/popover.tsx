import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export function PopoverContent({
  className,
  sideOffset = 6,
  style,
  ...props
}: PopoverPrimitive.PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'rounded-md border border-border-default bg-bg-default p-3 shadow-sm',
          'data-[state=open]:[animation:a05a-overlay-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-overlay-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
          className,
        )}
        style={{ zIndex: zIndex.popoverMenu, ...style }}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
