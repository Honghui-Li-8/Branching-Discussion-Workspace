import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '../../lib/utils'

// Determinate progress. Distinct from Skeleton (unknown-duration placeholder)
// and from AlertPopup's own auto-dismiss bar (which is a timer, not a task).
// Plausible real consumers: streaming-response progress, credit-balance
// meter — neither confirmed yet, so this is available-not-assigned.

export function Progress({
  className,
  value,
  ...props
}: ProgressPrimitive.ProgressProps & { value?: number | null }) {
  return (
    <ProgressPrimitive.Root
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-bg-muted', className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full bg-accent-default transition-transform"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}
