import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export type Elevation = 'none' | 'shadow'

export function DialogContent({
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
        style={{ zIndex: zIndex.dialog }}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-border-default bg-bg-default p-5',
          elevation === 'shadow' && 'shadow-overlay',
          'data-[state=open]:[animation:a05a-overlay-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-overlay-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
          className,
        )}
        style={{ zIndex: zIndex.dialog }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      className={cn('mb-1 text-label font-medium text-text-default', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      className={cn('mb-4 text-label text-text-secondary', className)}
      {...props}
    />
  )
}
