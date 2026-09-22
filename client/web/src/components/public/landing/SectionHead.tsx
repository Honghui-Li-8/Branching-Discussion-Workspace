import type { ReactNode } from 'react'
import { Stack } from '../../ui/layout'

// A08b — the one section head every landing block is introduced by: a teal
// uppercase eyebrow, the block title as an h2, and a one-line subtitle,
// centred. Figma's pattern, applied to A07's approved titles.
//
// The eyebrow is stored in normal case and uppercased by CSS, so the accessible
// text stays "The loop" rather than a shouted string a screen reader spells out.
// It is exported on its own because the hero reuses the treatment (Commit 2).
//
// `id` is the heading's, not the section's: the surrounding <section> points at
// it with aria-labelledby, which is what names the region.

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="m-0 text-caption font-semibold uppercase tracking-wider text-accent-strong">
    {children}
  </p>
)

export type SectionHeadProps = {
  id: string
  eyebrow: string
  title: string
  subtitle: string
}

export const SectionHead = ({ id, eyebrow, title, subtitle }: SectionHeadProps) => (
  <Stack gap="3" align="center" className="text-center">
    <Eyebrow>{eyebrow}</Eyebrow>
    <h2 id={id} className="m-0 text-display font-semibold text-text-default">
      {title}
    </h2>
    <p className="m-0 max-w-prose text-body text-text-secondary">{subtitle}</p>
  </Stack>
)
