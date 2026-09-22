import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Stack } from '../../ui/layout'

// A08b — the landing's one card, and the grid it sits in.
//
// Steps, use cases, About and the changelog were four hand-rolled copies of the
// same bordered box. This is that box named once, with the slots Figma's cards
// actually use: a tinted icon tile, a caption above the title, the title, the
// body, and a footer pinned to the bottom so cards in a row end together.
//
// It lives under landing/ rather than ui/ deliberately — one surface's pattern
// stays local until a second surface needs it, the same rule the layout
// primitives followed (A06). MarkedList sits here for the same reason: it is
// the body two of these cards take, not a component in its own right.

/** How many cards a row holds at the widest width; narrower widths step down. */
export type CardColumns = 1 | 2 | 3 | 4

// Literal class strings, not interpolation: Tailwind only emits utilities it
// can see verbatim in source.
const COLUMNS: Record<CardColumns, string> = {
  1: '',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
}

export type CardGridProps = {
  columns: CardColumns
  /** `ol` where the order is part of the content — the proof steps, the changelog. */
  as?: 'ul' | 'ol'
  children: ReactNode
}

/** role="list" restores list semantics that WebKit drops when list-style is none. */
export const CardGrid = ({ columns, as: Tag = 'ul', children }: CardGridProps) => (
  <Tag role="list" className={cn('m-0 grid list-none gap-6 p-0', COLUMNS[columns])}>
    {children}
  </Tag>
)

export type CardProps = {
  /** Glyph for the tinted tile above the title. From lib/icons.ts, never lucide directly. */
  icon?: LucideIcon
  /** Caption above the title — "Step 1" today. Visible text: the order is content. */
  caption?: string
  title: string
  /** Extra title-column content: a secondary label, a status pill. */
  meta?: ReactNode
  /** `split` sets the title column beside the body from md up; the default stacks them. */
  layout?: 'stacked' | 'split'
  /** Pinned to the bottom of the card, whatever the body above it runs to. */
  footer?: ReactNode
  children: ReactNode
}

export const Card = ({
  icon: Icon,
  caption,
  title,
  meta,
  layout = 'stacked',
  footer,
  children,
}: CardProps) => (
  <li
    className={cn(
      'rounded-lg border border-border-default bg-bg-default p-5',
      layout === 'split' ? 'grid gap-4 md:grid-cols-4 md:gap-8' : 'flex flex-col gap-3',
    )}
  >
    <Stack gap="2">
      {Icon ? (
        // 44px, Figma's tile: size-11 rather than a px pin, which ADR-0003 rejects.
        <span className="mb-1 inline-flex size-11 items-center justify-center rounded-lg bg-accent-tint text-accent-strong">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      {caption ? (
        <p className="m-0 text-caption font-semibold uppercase tracking-wider text-text-muted">
          {caption}
        </p>
      ) : null}
      <h3 className="m-0 text-title font-semibold text-text-default">{title}</h3>
      {meta}
    </Stack>
    <Stack gap="3" className={cn(layout === 'split' && 'md:col-span-3')}>
      {children}
    </Stack>
    {footer ? <div className="mt-auto">{footer}</div> : null}
  </li>
)

/** Marker colour. Never the only signal — the card's title says which list this
 *  is, so the tone only reinforces it (A05b's third accessibility rule). */
export type MarkerTone = 'accent' | 'success' | 'warning'

const MARKER_TONE: Record<MarkerTone, string> = {
  accent: 'text-accent-strong',
  success: 'text-success-strong',
  warning: 'text-warning-strong',
}

export type MarkedListProps = {
  items: readonly string[]
  icon: LucideIcon
  tone: MarkerTone
}

/** A card body that is a list: one icon marker per item instead of a disc. */
export const MarkedList = ({ items, icon: Icon, tone }: MarkedListProps) => (
  <ul role="list" className="m-0 grid list-none gap-2 p-0 text-label text-text-secondary">
    {items.map((item) => (
      <li key={item} className="flex gap-2">
        <Icon className={cn('mt-0.5 size-4 shrink-0', MARKER_TONE[tone])} aria-hidden="true" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
)
