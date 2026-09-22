/**
 * @jest-environment jsdom
 *
 * A06 — the shared public shell: landmarks, navigation, auth-aware CTA,
 * skip link and the narrow-screen menu. Asserted by role and name only.
 */
import { fireEvent, screen, within } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

import { renderWithProviders } from '../../testing/renderWithProviders'
import { PublicShell } from './PublicShell'

expect.extend(toHaveNoViolations)

const SERIOUS = new Set(['serious', 'critical'])
const seriousViolations = async (container: Element) => {
  const results = await axe(container)
  return results.violations.filter((v) => SERIOUS.has(String(v.impact)))
}

const Page = () => (
  <PublicShell>
    <h1>Page content</h1>
  </PublicShell>
)

describe('PublicShell (A06)', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn()
  })

  it('renders each landmark exactly once, in order', () => {
    renderWithProviders(<Page />)

    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    expect(screen.getByRole('main').id).toBe('main')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Page content')
  })

  it('puts the skip link first, pointing at the main landmark', () => {
    const { container } = renderWithProviders(<Page />)

    const firstLink = container.querySelector('a')
    expect(firstLink?.textContent).toBe('Skip to main content')
    expect(firstLink?.getAttribute('href')).toBe('/#main')

    fireEvent.click(firstLink!)
    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('header navigation lists the section anchors', () => {
    renderWithProviders(<Page />)

    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/#features',
      '/#roadmap',
      '/#about',
    ])
  })

  it('footer carries the section links, the legal links, the repository link and the contact link', () => {
    renderWithProviders(<Page />)

    const footer = screen.getByRole('contentinfo')
    const footerNav = within(footer).getByRole('navigation', { name: 'Footer' })
    const github = within(footerNav).getByRole('link', { name: 'GitHub' })
    expect(github.getAttribute('rel')).toBe('noopener noreferrer')
    expect(github.getAttribute('target')).toBe('_blank')
    // Three sections + GitHub, then the two legal pages (A08b: routes, not anchors).
    expect(within(footerNav).getAllByRole('link')).toHaveLength(6)
    // Each group's name describes what it holds: the repository link is its own
    // group, so "Sections" never names a list without section links.
    expect(within(footerNav).getAllByRole('list')).toHaveLength(3)
    expect(within(within(footerNav).getByRole('list', { name: 'Sections' })).getAllByRole('link')).toHaveLength(3)
    expect(
      within(within(footerNav).getByRole('list', { name: 'Project' })).getAllByRole('link').map((a) => a.textContent),
    ).toEqual(['GitHub'])
    expect(within(footerNav).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
    expect(within(footerNav).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(within(footer).getByRole('link', { name: 'Contact via GitHub' }).getAttribute('href')).toMatch(/\/issues$/)
  })

  describe('auth-aware CTA', () => {
    it('unknown: no action and no section navigation is offered yet', () => {
      renderWithProviders(<Page />, { authStatus: 'unknown' })
      const header = screen.getByRole('banner')
      expect(within(header).queryByRole('link', { name: 'Sign in' })).toBeNull()
      expect(within(header).queryByRole('link', { name: 'Open workspace' })).toBeNull()
      expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull()
    })

    it('unauthenticated: Sign in → /login', () => {
      renderWithProviders(<Page />, { authStatus: 'unauthenticated' })
      const cta = within(screen.getByRole('banner')).getByRole('link', { name: 'Sign in' })
      expect(cta.getAttribute('href')).toBe('/login')
    })

    it('authenticated: Open workspace → /, and no section navigation anywhere', () => {
      renderWithProviders(<Page />, { authStatus: 'authenticated' })
      const cta = within(screen.getByRole('banner')).getByRole('link', { name: 'Open workspace' })
      expect(cta.getAttribute('href')).toBe('/')
      // `/` is the workspace for this user, so section anchors would be dead links.
      expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull()
      expect(within(screen.getByRole('contentinfo')).queryByRole('link', { name: 'How it works' })).toBeNull()
      expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'GitHub' })).toBeTruthy()
      // The section group goes with its links rather than staying as an empty
      // list still named "Sections"; GitHub keeps its own accurate group.
      expect(within(screen.getByRole('contentinfo')).queryByRole('list', { name: 'Sections' })).toBeNull()
      expect(within(screen.getByRole('contentinfo')).getByRole('list', { name: 'Project' })).toBeTruthy()
      // The legal pages are routes, so they stay reachable while the dead anchors go.
      const footer = within(screen.getByRole('contentinfo'))
      expect(footer.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
      expect(footer.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    })
  })

  describe('narrow-screen menu', () => {
    it('is a named icon-only control that opens a dialog with the section links, and closes on Escape', () => {
      renderWithProviders(<Page />)

      const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
      fireEvent.click(trigger)

      const dialog = screen.getByRole('dialog', { name: 'Navigation' })
      expect(within(dialog).getAllByRole('link').map((a) => a.textContent)).toEqual([
        'How it works',
        'Where things stand',
        'About',
      ])
      expect(within(dialog).getByRole('button', { name: 'Close navigation menu' })).toBeTruthy()

      fireEvent.keyDown(dialog, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('closes after a section link is chosen', () => {
      renderWithProviders(<Page />)
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Where things stand' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByTestId('location').textContent).toBe('/#roadmap')
    })
  })

  describe('accessibility scan', () => {
    it.each(['unknown', 'unauthenticated', 'authenticated'] as const)(
      'has no serious violations when %s',
      async (authStatus) => {
        const { container } = renderWithProviders(<Page />, { authStatus })
        expect(await seriousViolations(container)).toHaveLength(0)
      },
    )

    it('has no serious violations with the menu open', async () => {
      const { baseElement } = renderWithProviders(<Page />)
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
      expect(await seriousViolations(baseElement)).toHaveLength(0)
    })
  })
})
