import { cn } from '../../lib/utils'

export type AlertTone = 'success' | 'warning' | 'error' | 'info'

// Matches the real Figma "Alerts / Banners" reference: white background,
// a subtle full border, a bolder left accent stripe, a small solid dot,
// bold colored title, plain-gray description below. Fully token-based —
// the "success/warning/info have no app tokens" gap the trial version of
// this file worked around is closed by the two-layer color system.
export const ALERT_TONE_STYLES: Record<
  AlertTone,
  { border: string; stripe: string; dot: string; tint: string; title: string; raw: string }
> = {
  // Tokenized to the SEMANTIC layer. The mapping from the trial branch's
  // hexes was exact — every value corresponds 1:1 to a ramp step, with
  // alert titles landing on the `hover` step, which the ramp design
  // anticipated ("one step darker: hover, or an alert title on white").
  // `raw` is the color as a plain CSS value for the one place opacity is
  // a continuous runtime number (alert-popup's progress bar) — Tailwind's
  // /N modifier can't express a slider input.
  success: {
    border: 'border-success-tint',
    stripe: 'border-l-success-default',
    dot: 'bg-success-default',
    tint: 'bg-success-default/20',
    title: 'text-success-hover',
    raw: 'var(--color-success-default)',
  },
  warning: {
    border: 'border-warning-tint',
    stripe: 'border-l-warning-default',
    dot: 'bg-warning-default',
    tint: 'bg-warning-default/20',
    title: 'text-warning-hover',
    raw: 'var(--color-warning-default)',
  },
  error: {
    border: 'border-error-tint',
    stripe: 'border-l-error-default',
    dot: 'bg-error-default',
    tint: 'bg-error-default/20',
    title: 'text-error-default',
    raw: 'var(--color-error-default)',
  },
  info: {
    border: 'border-info-tint',
    stripe: 'border-l-info-default',
    dot: 'bg-info-default',
    tint: 'bg-info-default/20',
    title: 'text-info-hover',
    raw: 'var(--color-info-default)',
  },
}

export function AlertBanner({
  tone,
  title,
  children,
  className,
}: {
  tone: AlertTone
  title: string
  children: React.ReactNode
  className?: string
}) {
  const styles = ALERT_TONE_STYLES[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg border border-l-4 bg-bg-default px-4 py-3',
        styles.border,
        styles.stripe,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} aria-hidden="true" />
        <span className={cn('text-label font-semibold', styles.title)}>{title}</span>
      </div>
      <p className="mt-0.5 text-label text-text-secondary">{children}</p>
    </div>
  )
}
