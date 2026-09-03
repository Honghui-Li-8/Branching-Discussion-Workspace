import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'
import type { Elevation } from './dialog'

// Built on Radix's Dialog primitive, styled as an edge panel — the standard
// convention (a Sheet is a Dialog with different placement/motion, not a
// separate accessibility model).
export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

export function SheetContent({
  className,
  elevation = 'shadow',
  children,
  ...props
}: DialogPrimitive.DialogContentProps & { elevation?: Elevation }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 bg-black/40',
          'data-[state=open]:[animation:a05a-backdrop-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-backdrop-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
        )}
        style={{ zIndex: zIndex.sheet }}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-sm border-l border-border-default bg-bg-default p-5',
          elevation === 'shadow' && 'shadow-panel',
          'data-[state=open]:[animation:a05a-sheet-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-sheet-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
          className,
        )}
        style={{ zIndex: zIndex.sheet }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function SheetTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      className={cn('mb-1 text-sm font-medium text-text-default', className)}
      {...props}
    />
  )
}

export function SheetDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      className={cn('mb-4 text-sm text-text-secondary', className)}
      {...props}
    />
  )
}
