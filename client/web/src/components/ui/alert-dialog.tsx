import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'
import type { Elevation } from './dialog'

// Deliberately NOT the same as dialog.tsx, despite looking similar. Radix
// AlertDialog differs in ways that matter for destructive confirms:
//   - role="alertdialog" (screen readers announce it as interrupting)
//   - cannot be dismissed by outside-click or Escape-to-nothing; the user
//     must pick an explicit action
//   - focus defaults to the Cancel action, not the destructive one
// The delete-workspace confirm should be this, not the generic Dialog it
// currently uses in the trials page.

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger
export const AlertDialogCancel = AlertDialogPrimitive.Cancel
export const AlertDialogAction = AlertDialogPrimitive.Action

export function AlertDialogContent({
  className,
  elevation = 'shadow',
  ...props
}: AlertDialogPrimitive.AlertDialogContentProps & { elevation?: Elevation }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 bg-black/40',
          'data-[state=open]:[animation:a05a-backdrop-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-backdrop-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
        )}
        style={{ zIndex: zIndex.dialog }}
      />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
          'flex flex-col gap-3 rounded-lg border border-border-default bg-bg-default p-5',
          elevation === 'shadow' && 'shadow-overlay',
          'data-[state=open]:[animation:a05a-overlay-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-overlay-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
          className,
        )}
        style={{ zIndex: zIndex.dialog }}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  )
}

export function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.AlertDialogTitleProps) {
  return (
    <AlertDialogPrimitive.Title
      className={cn('text-body font-semibold text-text-default', className)}
      {...props}
    />
  )
}

export function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.AlertDialogDescriptionProps) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-label text-text-secondary', className)}
      {...props}
    />
  )
}
