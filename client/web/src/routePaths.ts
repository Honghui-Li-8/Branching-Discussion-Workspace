// A06 — the route map as plain data, with no React in it.
//
// One source of truth, two adapters: `routes.tsx` attaches elements for the
// app, and the Playwright reflow harness (`e2e/a11y-reflow.e2e.ts`) reads the
// same paths to decide what to measure. Keeping this file React-free is what
// lets the harness import it without dragging components into Node.

export const PATHS = {
  root: '/',
  login: '/login',
  authCallback: '/auth/callback',
} as const

/**
 * Landing-page sections — one list, two views. The header (and the narrow
 * sheet) show the `inHeaderNav` subset; the footer lists them all. Ids are
 * stable anchors and never change; labels are A07's (2026-09-15 decisions).
 * A08 adds footer-only `privacy` and `terms` here with `inHeaderNav: false`.
 */
export const SECTIONS = [
  { id: 'features', label: 'How it works', inHeaderNav: true },
  { id: 'roadmap', label: 'Where things stand', inHeaderNav: true },
  { id: 'about', label: 'About', inHeaderNav: true },
  // A08 — legal sections, reachable from the footer only.
  { id: 'privacy', label: 'Privacy', inHeaderNav: false },
  { id: 'terms', label: 'Terms', inHeaderNav: false },
] as const

export type Section = (typeof SECTIONS)[number]
export type SectionId = Section['id']

/** The sections the header and sheet navigation show. */
export const HEADER_SECTIONS: readonly Section[] = SECTIONS.filter((s) => s.inHeaderNav)

/** Footer-only sections (the Legal group). */
export const FOOTER_ONLY_SECTIONS: readonly Section[] = SECTIONS.filter((s) => !s.inHeaderNav)

/**
 * The one contact channel (owner decision 2026-09-15): the repository's issues.
 * Used by the footer and by the Privacy and Terms sections.
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
  { name: 'not-found', path: '/this-route-does-not-exist' },
] as const
