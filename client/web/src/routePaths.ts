// A06 — the route map as plain data, with no React in it.
//
// One source of truth, two adapters: `routes.tsx` attaches elements for the
// app, and the Playwright reflow harness (`e2e/a11y-reflow.e2e.ts`) reads the
// same paths to decide what to measure. Keeping this file React-free is what
// lets the harness import it without dragging components into Node.

export const PATHS = {
  root: '/',
  login: '/login',
  privacy: '/privacy',
  terms: '/terms',
  authCallback: '/auth/callback',
} as const

/**
 * Landing-page sections — one list, one membership. The header, the narrow
 * sheet and the footer all show every entry. Ids are stable anchors and never
 * change; labels are A07's (2026-09-15 decisions). A08b moved Privacy and
 * Terms off the landing onto their own routes (LEGAL_PAGES below), so there is
 * no footer-only subset left to model.
 */
export const SECTIONS = [
  { id: 'features', label: 'How it works' },
  { id: 'roadmap', label: 'Where things stand' },
  { id: 'about', label: 'About' },
] as const

export type Section = (typeof SECTIONS)[number]
export type SectionId = Section['id']

/** A08b — the legal pages, listed in the shell's footer Legal group. */
export const LEGAL_PAGES = [
  { path: PATHS.privacy, label: 'Privacy' },
  { path: PATHS.terms, label: 'Terms' },
] as const

/**
 * The one contact channel (owner decision 2026-09-15): the repository's issues.
 * Used by the footer and by the Privacy and Terms pages.
 */
export const CONTACT_URL = 'https://github.com/Honghui-Li-8/Branching-Discussion-Workspace/issues'

export const sectionHref = (id: SectionId): string => `${PATHS.root}#${id}`

/**
 * What the reflow harness measures. The callback route is deliberately
 * absent: it renders a transient pending state and immediately navigates.
 * The last entry is any path the router does not know, for the not-found
 * surface.
 */
export const REFLOW_TARGETS = [
  { name: 'landing', path: PATHS.root },
  { name: 'login', path: PATHS.login },
  { name: 'privacy', path: PATHS.privacy },
  { name: 'terms', path: PATHS.terms },
  { name: 'not-found', path: '/this-route-does-not-exist' },
] as const
