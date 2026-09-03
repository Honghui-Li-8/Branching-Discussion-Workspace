import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { cn } from '../../lib/utils'

// Replaces hand-rolled `::-webkit-scrollbar` styling — index.css currently
// carries a `.sugg-row` webkit-only scrollbar rule for
// AssistantSelectionMenu, one of the ~250 styling one-offs A05c's inventory
// counted. Radix's ScrollArea renders a real cross-browser custom scrollbar
// instead of a Chrome/Safari-only pseudo-element hack.

export function ScrollArea({
  className,
  children,
  orientation = 'vertical',
  ...props
}: ScrollAreaPrimitive.ScrollAreaProps & { orientation?: 'vertical' | 'horizontal' | 'both' }) {
  return (
    <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      {(orientation === 'vertical' || orientation === 'both') && <ScrollBar orientation="vertical" />}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <ScrollBar orientation="horizontal" />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

export function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ScrollAreaPrimitive.ScrollAreaScrollbarProps) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      orientation={orientation}
      className={cn(
        'flex touch-none select-none transition-colors',
        orientation === 'vertical' && 'h-full w-1.5 border-l border-l-transparent p-[1px]',
        orientation === 'horizontal' && 'h-1.5 flex-col border-t border-t-transparent p-[1px]',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border-strong" />
    </ScrollAreaPrimitive.Scrollbar>
  )
}
