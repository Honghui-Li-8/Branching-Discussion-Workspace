import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'

// Distinct primitive from DropdownMenu, not a duplicate: this one is
// right-click (contextmenu) triggered and positions at the pointer, where
// DropdownMenu is click-triggered and anchors to its trigger element.
//
// This is the direct fix for A01's F02 blocker (workspace rename/delete is
// right-click-only, no visible affordance, no keyboard path) — Radix's
// ContextMenu keeps the right-click entry point but adds the keyboard and
// ARIA behavior the current hand-rolled `onContextMenu` in AppSidebar.tsx
// has none of. A05c's inventory names WorkspaceContextMenu.tsx as the
// strongest real-surface conversion candidate for exactly this reason.

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

export function ContextMenuContent({
  className,
  style,
  ...props
}: ContextMenuPrimitive.ContextMenuContentProps) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          'min-w-[180px] rounded-md border border-border-default bg-bg-default p-1 shadow-sm',
          'data-[state=open]:[animation:a05a-overlay-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-overlay-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
          className,
        )}
        style={{ zIndex: zIndex.popoverMenu, ...style }}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

export function ContextMenuItem({
  className,
  destructive,
  ...props
}: ContextMenuPrimitive.ContextMenuItemProps & { destructive?: boolean }) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-label outline-none transition-colors',
        'text-text-default data-[highlighted]:bg-bg-subtle',
        destructive && 'text-error-default data-[highlighted]:bg-error-default/10',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export const ContextMenuSeparator = ({
  className,
  ...props
}: ContextMenuPrimitive.ContextMenuSeparatorProps) => (
  <ContextMenuPrimitive.Separator className={cn('my-1 h-px bg-border-default', className)} {...props} />
)

export const ContextMenuLabel = ({
  className,
  ...props
}: ContextMenuPrimitive.ContextMenuLabelProps) => (
  <ContextMenuPrimitive.Label
    className={cn('px-2 py-1.5 text-caption font-medium text-text-muted', className)}
    {...props}
  />
)
