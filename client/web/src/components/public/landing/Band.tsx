import type { ReactNode } from 'react'
import { cn } from '../../../lib/utils'
import { Container } from '../../ui/layout'

// A08b — the landing's full-bleed horizontal band.
//
// The shell gives `main` the full viewport width, so a band is simply a
// block-level child that paints edge to edge and re-establishes the page
// column inside itself. That inversion — background outside the Container,
// content inside — is the whole reason this exists: the previous composition
// wrapped every section in one Container, which left no element wide enough to
// carry a background.
//
// Two tones only, alternating down the page (sections.ts owns the order). No
// gradients or glows: Figma's corner ellipses are out by A03a.

export type BandTone = 'default' | 'subtle'

const TONE: Record<BandTone, string> = {
  default: 'bg-bg-default',
  subtle: 'bg-bg-subtle',
}

export const Band = ({ tone = 'default', children }: { tone?: BandTone; children: ReactNode }) => (
  <div className={cn(TONE[tone], 'py-16 lg:py-20')}>
    <Container>{children}</Container>
  </div>
)
