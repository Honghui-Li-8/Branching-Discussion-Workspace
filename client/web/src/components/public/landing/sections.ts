import type { SectionId } from '../../../routePaths'
import type { BandTone } from './Band'

// A08b — the landing's five blocks as plain data, in page order.
//
// One list, one order, one place the copy lives. `routePaths.ts` already models
// the three blocks the navigation deep-links to; this models every block,
// including the two that gained a head without gaining an anchor (use cases and
// the changelog). `anchorId` is the join between the two lists: a block that
// has one renders with that id, tabIndex={-1} and the focus ring, and a block
// that does not is an ordinary labelled <section>.
//
// The eyebrows and subtitles are A08b's — owner-approved at checkpoint 1
// (2026-09-22). They are deliberately all in this file so the table can be
// swapped in one edit; nothing here is duplicated into a component or a test.
// Titles are different: those are A07's approved section labels.
//
// No subtitle states a count. The use-case cards are A07 decision 4's three
// seed workspaces, but the signed-in Create Workspace popover offers four, so a
// number here is a claim that goes stale the moment a seed is added.
//
// Eyebrows are written in normal case and uppercased by CSS (SectionHead).

export type LandingBlock = {
  /** Stable key — the section-body map's key, and the heading id for anchorless blocks. */
  readonly key: string
  /** The navigation anchor this block carries, or undefined if it has none. */
  readonly anchorId: SectionId | undefined
  readonly eyebrow: string
  readonly title: string
  readonly subtitle: string
  readonly tone: BandTone
}

export const LANDING_BLOCKS = [
  {
    key: 'how-it-works',
    anchorId: 'features',
    eyebrow: 'The loop',
    title: 'How it works',
    subtitle:
      'A side conversation that stays in the tree and returns a reviewed conclusion to where it started.',
    tone: 'default',
  },
  {
    key: 'use-cases',
    anchorId: undefined,
    eyebrow: 'Examples',
    title: 'Use cases',
    subtitle: 'Seed workspaces, available as starting examples after sign-in.',
    tone: 'subtle',
  },
  {
    key: 'where-things-stand',
    anchorId: 'roadmap',
    eyebrow: 'Status',
    title: 'Where things stand',
    subtitle: 'What the product does today, and what it does not.',
    tone: 'default',
  },
  {
    key: 'changelog',
    anchorId: undefined,
    eyebrow: 'History',
    title: 'Changelog',
    subtitle: 'What has shipped and what is in progress. Nothing planned is listed.',
    tone: 'subtle',
  },
  {
    // Last, and `default`: the footer is already bg-bg-subtle, so a subtle
    // About would merge into it instead of ending the page.
    key: 'about',
    anchorId: 'about',
    eyebrow: 'The project',
    title: 'About',
    subtitle: 'Why it exists, who builds it, and what to expect.',
    tone: 'default',
  },
] as const satisfies readonly LandingBlock[]

export type LandingBlockKey = (typeof LANDING_BLOCKS)[number]['key']
