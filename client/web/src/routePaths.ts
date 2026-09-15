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
 * Landing-page sections. A06 ships heading-only stubs with these ids so header
 * and footer anchors have real targets; A07 owns the final list, the labels
 * and all content, and renames here in one place.
 */
export const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'about', label: 'About' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

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
