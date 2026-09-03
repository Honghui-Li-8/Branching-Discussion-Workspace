import { cn } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-md bg-bg-muted', className)}
      style={{ animation: 'a05a-pulse var(--duration-pulse) ease-in-out infinite' }}
      aria-hidden="true"
    />
  )
}

export function Spinner({
  className,
  label = 'Loading',
  tone = 'accent',
}: {
  className?: string
  label?: string
  /** 'accent' (default) for standalone use on neutral backgrounds.
   *  'current' inherits the parent's text color for both the ring and the
   *  spinning highlight — needed inside a colored button (e.g. a red
   *  destructive button), where a hardcoded teal top-border would clash. */
  tone?: 'accent' | 'current'
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'h-4 w-4 rounded-full border-2',
        tone === 'accent' ? 'border-border-default' : 'border-current/30',
        className,
      )}
      style={{
        borderTopColor: tone === 'accent' ? 'var(--color-accent-default)' : 'currentColor',
        animation: 'a05a-spin var(--duration-spin) linear infinite',
      }}
    />
  )
}
