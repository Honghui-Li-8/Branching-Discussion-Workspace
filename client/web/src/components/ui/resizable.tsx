import { GripVertical } from 'lucide-react' // not in A05b's icons.ts map — flagged, real usage not covered there
import { Group, Panel, Separator, type GroupProps, type SeparatorProps } from 'react-resizable-panels'
import { cn } from '../../lib/utils'

// Not a Radix primitive — react-resizable-panels, the library shadcn itself
// uses for this. Relevant to real code: FoldedNodesMenu.tsx hand-rolls a
// resizable panel today, and NodeConversationPanel.tsx does its own manual
// sizing; both appear in A05c's inventory of hand-rolled overlays.
//
// Flagged like framer-motion: this is a NEW dependency, not part of A04a's
// originally validated package set (A04a did install it, but never wired it
// into any of the 16 compared categories, so it carries no verdict).
//
// NOTE: v4 renamed the API that most shadcn snippets still use —
// `Group`/`Separator` here, not the older `PanelGroup`/`PanelResizeHandle`,
// and orientation is a prop rather than `direction`. Worth knowing before
// copying any external example against this version.

export const ResizablePanelGroup = ({ className, ...props }: GroupProps) => (
  <Group className={cn('flex h-full w-full', className)} {...props} />
)

export const ResizablePanel = Panel

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator
      className={cn(
        'relative flex items-center justify-center bg-border-default',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-default',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        'data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-border-default bg-bg-default">
          <GripVertical className="h-2.5 w-2.5 text-text-muted" />
        </div>
      )}
    </Separator>
  )
}
