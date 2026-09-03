import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/utils'
import { zIndex } from '../../theme/zIndex'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  style,
  ...props
}: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'min-w-[180px] rounded-md border border-border-default bg-bg-default p-1 shadow-sm',
          'data-[state=open]:[animation:a05a-overlay-enter_var(--duration-overlay)_var(--ease-overlay-enter)]',
          'data-[state=closed]:[animation:a05a-overlay-exit_var(--duration-overlay)_var(--ease-overlay-exit)]',
          className,
        )}
        style={{ zIndex: zIndex.dropdownMenu, ...style }}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: DropdownMenuPrimitive.DropdownMenuItemProps & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        'text-text-default data-[highlighted]:bg-bg-subtle',
        destructive && 'text-error-default data-[highlighted]:bg-error-default/10',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export const DropdownMenuSeparator = ({
  className,
  ...props
}: DropdownMenuPrimitive.DropdownMenuSeparatorProps) => (
  <DropdownMenuPrimitive.Separator
    className={cn('my-1 h-px bg-border-default', className)}
    {...props}
  />
)
