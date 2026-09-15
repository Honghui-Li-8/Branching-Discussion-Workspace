/**
 * @jest-environment jsdom
 *
 * A06 — the route-level seam. Given a URL and an auth state, the right surface
 * renders with the right landmarks. Asserts by role and accessible name only;
 * never internal state, dispatch sequences, or component internals.
 */
import { screen, waitFor, within } from '@testing-library/react'

import App from './App'
import { failingFetch, pendingFetch, renderWithProviders } from './testing/renderWithProviders'

// The signed-in workspace subtree pulls ESM-only dependencies (@annotorious)
// that this CommonJS jest cannot transform, and it is explicitly unchanged by
// A06 (invariant 3). This seam tests *which* surface resolves, not the
// workspace itself, so the layout is replaced by a marker landmark.
jest.mock('./components/WorkspaceLayout', () => ({
  WorkspaceLayout: () => (
    <main data-testid="workspace-layout" aria-label="Workspace">
      Workspace (mocked)
    </main>
  ),
}))

const heading1 = () => screen.queryByRole('heading', { level: 1 })

describe('route resolution (A06)', () => {
  describe('/ — auth-aware root', () => {
    it('unknown: shows the neutral bootstrap state and neither the landing nor the workspace', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'unknown', fetchImpl: pendingFetch })

      expect(screen.getByRole('status').textContent).toMatch(/checking sign-in/i)
      expect(heading1()).toBeNull()
      expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
    })

    it('unauthenticated: resolves to the landing placeholder', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

      expect(screen.getByRole('main')).toBeTruthy()
      expect(heading1()?.textContent).toBe('Trellis')
      expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login')
      expect(screen.queryByText(/sign in to continue/i)).toBeNull()
    })

    it('unauthenticated: the landing carries the three stub sections with stable ids', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

      for (const id of ['features', 'roadmap', 'about']) {
        const section = document.getElementById(id)
        expect(section?.tagName).toBe('SECTION')
        expect(section?.getAttribute('tabindex')).toBe('-1')
      }
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'Features',
        'Roadmap',
        'About',
      ])
    })

    it('authenticated: resolves to the workspace with no landing flash', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'authenticated' })

      expect(screen.getByTestId('workspace-layout')).toBeTruthy()
      expect(screen.queryByRole('heading', { level: 1, name: 'Trellis' })).toBeNull()
      expect(screen.queryByText(/sign in to continue/i)).toBeNull()
      expect(screen.queryByText(/checking sign-in/i)).toBeNull()
    })

    it('bootstrap resolves unauthenticated when the API is unreachable — the landing, never a spinner', async () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'unknown', fetchImpl: failingFetch })

      await waitFor(() => expect(heading1()?.textContent).toBe('Trellis'))
      expect(screen.queryByText(/checking sign-in/i)).toBeNull()
    })
  })

  describe('every public route renders inside the one shell', () => {
    it.each([
      ['/', 'unauthenticated'],
      ['/', 'unknown'],
      ['/login', 'unauthenticated'],
      ['/login', 'authenticated'],
      ['/nope', 'unauthenticated'],
    ] as const)('%s when %s: banner, one main, contentinfo, skip link', (route, authStatus) => {
      const { container } = renderWithProviders(<App />, { route, authStatus })

      expect(screen.getAllByRole('banner')).toHaveLength(1)
      expect(screen.getAllByRole('main')).toHaveLength(1)
      expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
      expect(container.querySelector('a')?.textContent).toBe('Skip to main content')
      expect(screen.queryAllByRole('heading', { level: 1 }).length).toBeLessThanOrEqual(1)
    })

    it('the signed-in workspace stays outside the shell', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'authenticated' })
      expect(screen.queryByRole('banner')).toBeNull()
      expect(screen.queryByRole('contentinfo')).toBeNull()
    })
  })

  describe('/login — a real page, regardless of auth state', () => {
    it.each(['unknown', 'unauthenticated', 'authenticated'] as const)(
      'renders the sign-in surface when %s',
      (authStatus) => {
        renderWithProviders(<App />, { route: '/login', authStatus })

        expect(heading1()?.textContent).toBe('Sign in to continue')
        expect(screen.getByRole('button', { name: /sign in with google/i })).toBeTruthy()
        expect(screen.getByTestId('location').textContent).toBe('/login')
      },
    )

    it('keeps the local developer bypass reachable on the new route', () => {
      renderWithProviders(<App />, { route: '/login', authStatus: 'unauthenticated' })

      expect(screen.getByRole('button', { name: /continue as local developer/i })).toBeTruthy()
    })
  })

  describe('unknown URL — not-found with auth-aware recovery', () => {
    it('stays on the unknown URL instead of silently redirecting', () => {
      renderWithProviders(<App />, { route: '/nope/nothing-here', authStatus: 'unauthenticated' })

      expect(screen.getByTestId('location').textContent).toBe('/nope/nothing-here')
      expect(heading1()?.textContent).toBe('Page not found')
    })

    it('unauthenticated: offers home and sign-in', () => {
      renderWithProviders(<App />, { route: '/nope', authStatus: 'unauthenticated' })

      const nav = within(screen.getByRole('navigation', { name: 'Recovery' }))
      expect(nav.getByRole('link', { name: 'Go to home' }).getAttribute('href')).toBe('/')
      expect(nav.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login')
      expect(nav.queryByRole('link', { name: 'Open workspace' })).toBeNull()
    })

    it('authenticated: offers the workspace only', () => {
      renderWithProviders(<App />, { route: '/nope', authStatus: 'authenticated' })

      const nav = within(screen.getByRole('navigation', { name: 'Recovery' }))
      expect(nav.getByRole('link', { name: 'Open workspace' }).getAttribute('href')).toBe('/')
      expect(nav.queryByRole('link', { name: 'Sign in' })).toBeNull()
      expect(nav.queryByRole('link', { name: 'Go to home' })).toBeNull()
    })

    it('unknown: offers home only, never a state it cannot vouch for', () => {
      renderWithProviders(<App />, { route: '/nope', authStatus: 'unknown', fetchImpl: pendingFetch })

      const nav = within(screen.getByRole('navigation', { name: 'Recovery' }))
      expect(nav.getByRole('link', { name: 'Go to home' })).toBeTruthy()
      expect(nav.queryByRole('link', { name: 'Sign in' })).toBeNull()
      expect(nav.queryByRole('link', { name: 'Open workspace' })).toBeNull()
    })
  })
})
