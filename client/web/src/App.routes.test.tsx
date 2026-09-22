/**
 * @jest-environment jsdom
 *
 * A06 — the route-level seam. Given a URL and an auth state, the right surface
 * renders with the right landmarks. Asserts by role and accessible name only;
 * never internal state, dispatch sequences, or component internals.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import App from './App'
import { LandingRoute } from './components/public/LandingRoute'
import { LANDING_BLOCKS } from './components/public/landing/sections'
import * as supabaseClient from './lib/supabaseClient'
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

      expect(screen.getByRole('status').textContent).toMatch(/confirm your session/i)
      expect(heading1()?.textContent).toBe('Checking sign-in')
      expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
    })

    it('unauthenticated: resolves to the landing placeholder', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

      expect(screen.getByRole('main')).toBeTruthy()
      expect(heading1()?.textContent).toBe('Trellis')
      expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login')
      expect(screen.queryByText(/sign in to continue/i)).toBeNull()
    })

    it('unauthenticated: the landing carries every section with a stable, focusable id', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

      for (const id of ['features', 'roadmap', 'about']) {
        const section = document.getElementById(id)
        expect(section?.tagName).toBe('SECTION')
        expect(section?.getAttribute('tabindex')).toBe('-1')
      }
      // A08b — five heads in page order; use cases and the changelog gained a
      // head without gaining an anchor, so they are not navigation targets.
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'How it works',
        'Use cases',
        'Where things stand',
        'Changelog',
        'About',
      ])
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    })

    it('unauthenticated: every section head renders its eyebrow and subtitle (A08b)', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

      // Driven from the block list rather than a copy table repeated here: the
      // head copy is owner-approved (checkpoint 1) but must stay swappable in one
      // file. What this asserts is the mechanism — every head renders both.
      for (const block of LANDING_BLOCKS) {
        const section = screen
          .getByRole('heading', { level: 2, name: block.title })
          .closest('section')!
        expect(section.getAttribute('aria-labelledby')).toBeTruthy()
        // Stored in normal case; the uppercasing is CSS, not the text.
        expect(section.textContent).toContain(block.eyebrow)
        expect(section.textContent).toContain(block.subtitle)
      }
    })

    it('authenticated: resolves to the workspace with no landing flash', () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'authenticated' })

      expect(screen.getByTestId('workspace-layout')).toBeTruthy()
      expect(screen.queryByRole('heading', { level: 1, name: 'Trellis' })).toBeNull()
      expect(screen.queryByText(/sign in to continue/i)).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Checking sign-in' })).toBeNull()
    })

    it('bootstrap resolves unauthenticated when the API is unreachable — the landing, never a spinner', async () => {
      renderWithProviders(<App />, { route: '/', authStatus: 'unknown', fetchImpl: failingFetch })

      await waitFor(() => expect(heading1()?.textContent).toBe('Trellis'))
      expect(screen.queryByRole('heading', { name: 'Checking sign-in' })).toBeNull()
    })
  })

  describe('every public route renders inside the one shell', () => {
    it.each([
      ['/', 'unauthenticated'],
      ['/', 'unknown'],
      ['/login', 'unauthenticated'],
      ['/login', 'authenticated'],
      ['/privacy', 'unauthenticated'],
      ['/privacy', 'authenticated'],
      ['/terms', 'unauthenticated'],
      ['/terms', 'authenticated'],
      ['/nope', 'unauthenticated'],
    ] as const)('%s when %s: banner, one main, contentinfo, skip link', (route, authStatus) => {
      const { container } = renderWithProviders(<App />, { route, authStatus })

      expect(screen.getAllByRole('banner')).toHaveLength(1)
      expect(screen.getAllByRole('main')).toHaveLength(1)
      expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
      expect(container.querySelector('a')?.textContent).toBe('Skip to main content')
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
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

describe('sign-in flow surfaces (A06 Commit 5)', () => {
  const okResponse = (payload: unknown): Response =>
    ({ ok: true, status: 200, json: async () => payload }) as unknown as Response

  it('/auth/callback renders the pending state only, inside the shell', () => {
    // Hold the exchange open so the pending surface is what we observe.
    const spy = jest.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue({
      auth: { getSession: () => new Promise(() => {}) },
    } as unknown as ReturnType<typeof supabaseClient.getSupabaseClient>)
    renderWithProviders(<App />, { route: '/auth/callback', authStatus: 'unauthenticated' })

    expect(screen.getByRole('status').textContent).toMatch(/hand-off/i)
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(heading1()?.textContent).toBe('Completing sign-in')
    spy.mockRestore()
  })

  it('a failed callback lands on /login with the error as an alert beside the retry action', async () => {
    // No Supabase configuration in tests → getSession throws → failure path.
    renderWithProviders(<App />, { route: '/auth/callback', authStatus: 'unauthenticated' })

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Sign-in failed')
    expect(alert.textContent).toContain('Sign-in is not configured yet.')
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeTruthy()
  })

  it('the local bypass succeeds from /login and lands in the workspace through the shared seam', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/auth/login')) {
        return okResponse({
          authenticated: true,
          user: {
            id: 'u',
            authUserId: 'a',
            email: null,
            displayName: null,
            creditBalance: 0,
          },
        })
      }
      return new Promise<Response>(() => {})
    }
    renderWithProviders(<App />, { route: '/login', authStatus: 'unauthenticated', fetchImpl })

    fireEvent.click(screen.getByRole('button', { name: /continue as local developer/i }))

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
    expect(screen.getByTestId('workspace-layout')).toBeTruthy()
  })
})

describe('landing content (A07)', () => {
  it('How it works carries the four-step proof sequence, and use cases are their own block', () => {
    renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

    // A08b — the wrapper h3s are gone, so the steps and the use-case cards are
    // each the first heading level under their own head.
    const features = document.getElementById('features')!
    const steps = within(features).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(steps).toEqual(['Branch', 'Explore', 'Approve and bring back', 'Resume'])
    // A08b — the number is visible text on the card, not a decorative badge, so
    // the order survives for a reader who meets the cards one at a time.
    expect(within(features).getAllByText(/^Step \d$/).map((n) => n.textContent)).toEqual([
      'Step 1',
      'Step 2',
      'Step 3',
      'Step 4',
    ])

    const useCases = screen.getByRole('heading', { level: 2, name: 'Use cases' }).closest('section')!
    expect(useCases.id).toBe('')
    expect(useCases.getAttribute('tabindex')).toBeNull()
    expect(within(useCases).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Project decision',
      'Database selection',
      'Project walkthrough',
    ])
  })

  it('hero shows the product visual with its alt text and the CTA per auth state', () => {
    renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })
    const img = screen.getByRole('img', { name: /project decision/i })
    expect(img.getAttribute('src')).toBe('/landing/intro-workspace-tree.png')
    // A08b — the capture is cropped to five named topics, so the alt text names
    // those and no longer describes the root card the crop leaves out.
    expect(img.getAttribute('alt')).toContain('Will this create strong interview signal?')
    expect(img.getAttribute('alt')).not.toContain('Should I build this project now?')
    expect(screen.getByRole('link', { name: 'Sign in with Google' }).getAttribute('href')).toBe('/login')
    expect(screen.getByRole('link', { name: 'See how it works' }).getAttribute('href')).toBe('/#features')
    // A08b — the descriptor claims only what the product does: branching starts at a reply.
    const main = screen.getByRole('main')
    expect(main.textContent).toContain('branch off an assistant reply into a side conversation')
    expect(main.textContent).not.toMatch(/any message|any point/i)
  })

  it('the hero states the project status as an eyebrow, not a sentence with a link', () => {
    renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

    // Stored in normal case — CSS does the uppercasing, so this is what a
    // screen reader reads out.
    expect(screen.getByText('Early beta · solo side project')).toBeTruthy()
    const main = screen.getByRole('main')
    expect(main.textContent).not.toContain('An early beta and a solo side project')
    // The status link left the hero with the sentence; About's is now the only one.
    expect(within(main).getAllByRole('link', { name: 'See where things stand' })).toHaveLength(1)
  })

  it('Where things stand lists what works now and all five limitations', () => {
    renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

    const section = document.getElementById('roadmap')!
    const headings = within(section).getAllByRole('heading', { level: 3 })
    expect(headings.map((h) => h.textContent)).toEqual(['What works now', 'Limitations'])
    // A08b — one card per list, each item marked rather than bulleted. The
    // markers are aria-hidden, so the count is still the five items themselves.
    const [worksNow, limitations] = headings.map((h) => h.closest('li')!)
    expect(within(worksNow).getAllByRole('listitem')).toHaveLength(5)
    expect(within(limitations).getAllByRole('listitem')).toHaveLength(5)
    expect(section.textContent).toMatch(/read-only history/)
    expect(section.textContent).toMatch(/private to the account/)
    expect(section.textContent).toMatch(/Safari is not supported/)
    expect(section.textContent).toMatch(/signs everyone out/)
  })

  it('the changelog is its own block: two entries, newest first, with their statuses', () => {
    renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

    // A08 content, A08b placement: out of "Where things stand" into a block of
    // its own, so the entry versions are h3 and #roadmap no longer contains them.
    const section = screen.getByRole('heading', { level: 2, name: 'Changelog' }).closest('section')!
    expect(section.id).toBe('')
    expect(section.getAttribute('tabindex')).toBeNull()
    expect(within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'MVP 1.5',
      'MVP 1',
    ])
    expect(section.textContent).toContain('In progress')
    expect(section.textContent).toContain('Shipped')
    // A08b — one card per entry. No entry is planned work: the only "planned"
    // on the page is the head saying so (A08: no promises of dates or features).
    const entries = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.closest('li')!.textContent)
    expect(entries).toHaveLength(2)
    expect(entries.join(' ')).not.toMatch(/planned/i)
    expect(section.textContent).not.toMatch(/email sign-in/i)
    expect(document.getElementById('roadmap')!.textContent).not.toContain('MVP 1.5')
  })

  it('hero offers no action while auth is unknown', () => {
    // RootRoute never shows the landing while unknown; render the route directly so the
    // hero's own guard is the thing under test.
    renderWithProviders(<LandingRoute />, { route: '/', authStatus: 'unknown', fetchImpl: pendingFetch })
    expect(screen.queryByRole('link', { name: 'Sign in with Google' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open workspace' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Trellis')
  })
})

describe('document titles (A08)', () => {
  it.each([
    ['/', 'unauthenticated', 'Trellis'],
    ['/login', 'unauthenticated', 'Sign in · Trellis'],
    ['/privacy', 'unauthenticated', 'Privacy · Trellis'],
    ['/terms', 'unauthenticated', 'Terms · Trellis'],
    ['/this-does-not-exist', 'unauthenticated', 'Page not found · Trellis'],
    ['/', 'authenticated', 'Trellis'],
  ] as const)('%s when %s titles the document "%s"', (route, authStatus, title) => {
    renderWithProviders(<App />, { route, authStatus })
    expect(document.title).toBe(title)
  })
})

describe('About section (A08)', () => {
  it('carries the three project cards and points limitations at Where things stand', () => {
    renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })
    const section = document.getElementById('about')!
    expect(within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Why branching',
      'About this project',
      'Current limitations',
    ])
    expect(within(section).getByRole('link', { name: 'See where things stand' }).getAttribute('href')).toBe('/#roadmap')
    expect(section.textContent).not.toMatch(/single account/i)
    // A08b — same correction as the hero: you branch from a reply, not from anywhere.
    expect(section.textContent).toContain('branch from any assistant reply')
    expect(section.textContent).not.toMatch(/any message|any point/i)
  })
})

describe('Privacy and Terms pages (A08b)', () => {
  it('the header keeps its three section links and the footer Legal group points at the routes', () => {
    renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

    const headerNav = within(screen.getByRole('banner')).getByRole('navigation', { name: 'Sections' })
    expect(within(headerNav).getAllByRole('link')).toHaveLength(3)

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
    expect(within(footer).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(within(footer).getByRole('link', { name: 'Contact via GitHub' }).getAttribute('href')).toMatch(/\/issues$/)
    expect(footer.textContent).not.toMatch(/coming soon/)
  })

  it.each(['unauthenticated', 'authenticated'] as const)(
    'the legal links are in the footer when %s',
    (authStatus) => {
      // /login is a shell surface that exists in both auth states, unlike `/`.
      renderWithProviders(<App />, { route: '/login', authStatus })

      const footer = screen.getByRole('contentinfo')
      expect(within(footer).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
      expect(within(footer).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    },
  )

  it('/privacy names the stored data and exactly the five third parties', () => {
    renderWithProviders(<App />, { route: '/privacy', authStatus: 'unauthenticated' })

    expect(heading1()?.textContent).toBe('Privacy')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'What we collect',
      'How it is stored',
      'Processing',
      'Retention and deletion',
      'Third parties involved',
    ])

    const main = screen.getByRole('main')
    for (const party of ['Google', 'Supabase', 'OpenAI', 'Vercel', 'Fly.io']) {
      expect(main.textContent).toContain(party)
    }
    expect(main.textContent).toMatch(/no automated deletion or retention/i)
    expect(main.textContent).not.toMatch(/encrypt|compliant|GDPR|never trained/i)
    expect(
      within(main).getByRole('link', { name: 'Request deletion via GitHub' }).getAttribute('href'),
    ).toMatch(/\/issues$/)
  })

  it('/terms carries its four parts in order', () => {
    renderWithProviders(<App />, { route: '/terms', authStatus: 'unauthenticated' })

    expect(heading1()?.textContent).toBe('Terms')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Beta expectations',
      'Acceptable use',
      'No guarantee',
      'Contact',
    ])
  })

  it('a signed-in visitor reads /privacy instead of being sent to the workspace', () => {
    renderWithProviders(<App />, { route: '/privacy', authStatus: 'authenticated' })

    expect(heading1()?.textContent).toBe('Privacy')
    expect(screen.queryByTestId('workspace-layout')).toBeNull()
  })

  it('the landing no longer carries the legal copy', () => {
    renderWithProviders(<App />, { route: '/', authStatus: 'unauthenticated' })

    expect(screen.getByRole('main').textContent).not.toMatch(/What we collect/)
  })
})
