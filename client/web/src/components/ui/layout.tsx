import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/utils'

// A06 — the three layout primitives A-T3c deferred to its first real consumer.
// Exactly three, by rule ("driven by what A06–A11b actually need, not a
// speculative library"): a vertical Stack, a horizontal wrapping Cluster, and
// a constrained-width Container. No grid until a surface needs one.
//
// Spacing is typed as a closed union of 4px-grid steps rather than free
// strings. ADR-0002: there is no spacing token layer because the design
// source's scale already IS Tailwind's default grid, so the union below is the
// Figma scale expressed as `gap-{n}` — and it is what keeps ADR-0003's
// "no arbitrary values" a compile-time property here instead of a review chore.

/** Figma's locked `space/*` steps that make sense as a gap, on the 4px grid. */
export type SpaceStep = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '16' | '24'

// Literal class strings, not template interpolation: Tailwind's scanner only
// emits utilities it can see verbatim in source.
const GAP: Record<SpaceStep, string> = {
  '0': 'gap-0',
  '1': 'gap-1',
  '2': 'gap-2',
  '3': 'gap-3',
  '4': 'gap-4',
  '5': 'gap-5',
  '6': 'gap-6',
  '8': 'gap-8',
  '10': 'gap-10',
  '12': 'gap-12',
  '16': 'gap-16',
  '24': 'gap-24',
}

const PADDING_X: Record<SpaceStep, string> = {
  '0': 'px-0',
  '1': 'px-1',
  '2': 'px-2',
  '3': 'px-3',
  '4': 'px-4',
  '5': 'px-5',
  '6': 'px-6',
  '8': 'px-8',
  '10': 'px-10',
  '12': 'px-12',
  '16': 'px-16',
  '24': 'px-24',
}

type Align = 'stretch' | 'start' | 'center' | 'end'
type Justify = 'start' | 'center' | 'end' | 'between'

const ALIGN: Record<Align, string> = {
  stretch: 'items-stretch',
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
}

const JUSTIFY: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
}

/**
 * Widths a Container may take. `page` is the public shell's column
 * (Tailwind's `6xl`, 72rem — the 1440 Figma canvas's content width);
 * `prose`/`narrow` are ADR-0001's line-length measures.
 */
export type ContainerWidth = 'page' | 'prose' | 'narrow'

const MAX_WIDTH: Record<ContainerWidth, string> = {
  page: 'max-w-6xl',
  prose: 'max-w-prose',
  narrow: 'max-w-narrow',
}

type LayoutBaseProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  /** Rendered element. Defaults to `div`; pass `section`, `nav`, `ul`… for semantics. */
  as?: ElementType
  children?: ReactNode
}

export type StackProps = LayoutBaseProps & {
  /** Vertical gap between children, in 4px-grid steps. */
  gap?: SpaceStep
  align?: Align
}

/** Vertical flow with a token gap. */
export function Stack({
  as: Tag = 'div',
  gap = '4',
  align = 'stretch',
  className,
  children,
  ...props
}: StackProps) {
  return (
    <Tag className={cn('flex flex-col', GAP[gap], ALIGN[align], className)} {...props}>
      {children}
    </Tag>
  )
}

export type ClusterProps = LayoutBaseProps & {
  /** Gap between items, both axes, in 4px-grid steps. */
  gap?: SpaceStep
  align?: Align
  justify?: Justify
}

/** Horizontal group that wraps when it runs out of room — nav items, tags, actions. */
export function Cluster({
  as: Tag = 'div',
  gap = '3',
  align = 'center',
  justify = 'start',
  className,
  children,
  ...props
}: ClusterProps) {
  return (
    <Tag
      className={cn('flex flex-wrap', GAP[gap], ALIGN[align], JUSTIFY[justify], className)}
      {...props}
    >
      {children}
    </Tag>
  )
}

export type ContainerProps = LayoutBaseProps & {
  width?: ContainerWidth
  /** Horizontal gutter, in 4px-grid steps — the space that keeps content off the viewport edge. */
  paddingX?: SpaceStep
}

/** Centered, width-constrained column. */
export function Container({
  as: Tag = 'div',
  width = 'page',
  paddingX = '4',
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <Tag
      className={cn('mx-auto w-full', MAX_WIDTH[width], PADDING_X[paddingX], className)}
      {...props}
    >
      {children}
    </Tag>
  )
}
