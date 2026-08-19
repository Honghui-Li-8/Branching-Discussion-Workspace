import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react' // not in A05b's icons.ts map — flagged, real usage not covered there
import { cn } from '../../lib/utils'
import { Dialog, DialogContent } from './dialog'

// Command palette (⌘K). Built on cmdk — a NEW dependency, flagged: A04a
// installed it but never wired it into any of the 16 compared categories,
// so it carries no verdict, same status as react-resizable-panels.
//
// Worth being explicit about scope: unlike the other primitives here, this
// one isn't filling a gap in an existing surface — nothing in Trellis has a
// command palette today, and adding one is a product decision (what commands
// exist, how they're discovered) more than a component decision. This is the
// shell for that, ready if the feature is wanted; it does nothing on its own.
//
// CommandDialog reuses our own Dialog (so it inherits the settled shadow
// elevation, backdrop fade, and z-index role) rather than declaring another
// overlay.

export const Command = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-lg bg-bg-default text-text-default',
      className,
    )}
    {...props}
  />
)

export const CommandDialog = ({ children, ...props }: React.ComponentProps<typeof Dialog>) => (
  <Dialog {...props}>
    <DialogContent className="w-[min(32rem,calc(100vw-2rem))] overflow-hidden p-0">
      <Command>{children}</Command>
    </DialogContent>
  </Dialog>
)

export const CommandInput = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) => (
  <div className="flex items-center gap-2 border-b border-border-default px-3">
    <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
    <CommandPrimitive.Input
      className={cn(
        'h-11 w-full bg-transparent text-sm text-text-default outline-none',
        'placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  </div>
)

export const CommandList = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    className={cn('max-h-72 overflow-y-auto overflow-x-hidden p-1', className)}
    {...props}
  />
)

export const CommandEmpty = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty
    className={cn('py-6 text-center text-sm text-text-muted', className)}
    {...props}
  />
)

export const CommandGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    className={cn(
      'overflow-hidden text-text-default',
      '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
      '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-muted',
      className,
    )}
    {...props}
  />
)

export const CommandItem = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    className={cn(
      'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none',
      'data-[selected=true]:bg-bg-subtle',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className,
    )}
    {...props}
  />
)

export const CommandSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator className={cn('my-1 h-px bg-border-default', className)} {...props} />
)

export const CommandShortcut = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span className={cn('ml-auto text-xs tracking-widest text-text-muted', className)} {...props} />
)
