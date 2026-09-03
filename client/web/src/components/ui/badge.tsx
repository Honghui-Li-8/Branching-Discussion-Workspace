import { cn } from '../../lib/utils'

export type BadgeStatus =
  | 'success'
  | 'warning'
  | 'info'
  | 'exploring'
  | 'merged'
  | 'pending'
  | 'folded'
  | 'selected'
  | 'read-only'
  | 'error'

// The owner's settled per-status palette (2026-08-18), tokenized to the
// SEMANTIC layer — never the palette layer — so repointing a semantic
// (info → teal, say) restyles every badge for free.
//
// Decision record, carried from the trials branch:
// - exploring/selected share accent on purpose: both mean "this is the
//   active thing". A deliberate overlap, not a collision.
// - merged is purple, chosen over A03a's locked gray alias. Figma's
//   state-merged still points at text-muted and needs repointing — until
//   then code and design disagree on this one token.
// - folded/read-only share one neutral treatment (owner call). They
//   differed before — read-only used the lighter text-muted — a
//   distinction nothing depended on; the darker text is also the
//   accessible pick (~8:1 vs ~3.8:1, which was under the 4.5:1 floor).
//   neutral-wash/neutral-strong resolve to the same grays the trial
//   version borrowed from bg-muted/text-secondary — the rename states
//   the decision instead of borrowing surface roles.
// - pending is indigo (deliberately open: may not earn its own hue).
// - info is blue (deliberately open: may repoint to teal).
const STATUS_STYLES: Record<BadgeStatus, string> = {
  exploring: 'bg-accent-tint text-accent-active',
  selected: 'bg-accent-tint text-accent-active',
  merged: 'bg-merged-tint text-merged-strong',
  success: 'bg-success-tint text-success-strong',
  warning: 'bg-warning-tint text-warning-strong',
  info: 'bg-info-tint text-info-strong',
  pending: 'bg-pending-tint text-pending-strong',
  error: 'bg-error-tint text-error-default',
  folded: 'bg-neutral-wash text-neutral-strong',
  'read-only': 'bg-neutral-wash text-neutral-strong',
}

export function Badge({
  status,
  children,
  className,
}: {
  status: BadgeStatus
  children: React.ReactNode
  className?: string
}) {
  return (
    // Matches the real Figma "Component states — Tag" reference: rounded
    // box (radius-md), not a full pill; capitalized label.
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-caption font-medium capitalize',
        STATUS_STYLES[status],
        className,
      )}
    >
      {children}
    </span>
  )
}
