/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { Link, useHashFocus } from './link'

const LocationProbe = () => {
  const location = useLocation()
  return <output data-testid="loc">{location.pathname + location.hash}</output>
}

const renderAt = (initialEntry: string, ui: ReactNode) =>
  render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  )

describe('ui Link (A06)', () => {
  beforeAll(() => {
    // jsdom has no layout engine and no scrollIntoView; the component guards
    // the call, but a spy lets the same-page test assert it was requested.
    Element.prototype.scrollIntoView = jest.fn()
  })

  describe('internal route path', () => {
    it('renders an anchor with the route href and navigates client-side on click', () => {
      renderAt('/', <Link to="/login">Sign in</Link>)
      const anchor = screen.getByRole('link', { name: 'Sign in' })
      expect(anchor.getAttribute('href')).toBe('/login')

      fireEvent.click(anchor)
      // The memory router moved — no document navigation was involved.
      expect(screen.getByTestId('loc').textContent).toBe('/login')
    })

    it('keeps the style API: underline always / hover', () => {
      renderAt('/', <Link to="/a" underline="always">A</Link>)
      expect(screen.getByRole('link', { name: 'A' }).className).toContain(' underline')
    })

    it('forwards className and other anchor props', () => {
      renderAt('/', <Link to="/a" className="text-caption" aria-current="page">A</Link>)
      const anchor = screen.getByRole('link', { name: 'A' })
      expect(anchor.className).toContain('text-caption')
      expect(anchor.getAttribute('aria-current')).toBe('page')
    })
  })

  describe('section anchor path', () => {
    it('same page: navigates to the hash and moves focus to the section', () => {
      renderAt(
        '/',
        <>
          <Link to="/#features">Features</Link>
          <section id="features" tabIndex={-1} aria-label="Features" />
        </>,
      )
      const section = screen.getByRole('region', { name: 'Features' })
      section.scrollIntoView = jest.fn()

      fireEvent.click(screen.getByRole('link', { name: 'Features' }))

      expect(screen.getByTestId('loc').textContent).toBe('/#features')
      expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      expect(document.activeElement).toBe(section)
    })

    it('cross-route: only navigates; the destination page focuses the section on arrival', () => {
      const Landing = () => {
        useHashFocus()
        return <section id="roadmap" aria-label="Roadmap" />
      }
      renderAt(
        '/login',
        <Routes>
          <Route path="/login" element={<Link to="/#roadmap">Roadmap</Link>} />
          <Route path="/" element={<Landing />} />
        </Routes>,
      )
      // The target does not exist yet — click must not throw.
      fireEvent.click(screen.getByRole('link', { name: 'Roadmap' }))
      expect(screen.getByTestId('loc').textContent).toBe('/#roadmap')

      // On arrival the hook resolved the target, made it focusable, focused it.
      const section = screen.getByRole('region', { name: 'Roadmap' })
      expect(section.getAttribute('tabindex')).toBe('-1')
      expect(document.activeElement).toBe(section)
    })

    it('a repeated click on the current hash still re-focuses the section', () => {
      renderAt(
        '/#about',
        <>
          <Link to="/#about">About</Link>
          <section id="about" tabIndex={-1} aria-label="About" />
        </>,
      )
      const section = screen.getByRole('region', { name: 'About' })
      screen.getByRole('link', { name: 'About' }).focus()
      expect(document.activeElement).not.toBe(section)

      fireEvent.click(screen.getByRole('link', { name: 'About' }))
      expect(document.activeElement).toBe(section)
    })
  })

  describe('external path', () => {
    it('renders a plain anchor with the href', () => {
      render(<Link href="https://github.com/x/y">GitHub</Link>)
      expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe('https://github.com/x/y')
    })

    it('adds rel safety attributes when opening a new tab, preserving any rel given', () => {
      render(
        <>
          <Link href="https://a.example" target="_blank">A</Link>
          <Link href="https://b.example" target="_blank" rel="me">B</Link>
          <Link href="https://c.example">C</Link>
        </>,
      )
      expect(screen.getByRole('link', { name: 'A' }).getAttribute('rel')).toBe('noopener noreferrer')
      expect(screen.getByRole('link', { name: 'B' }).getAttribute('rel')).toBe('noopener noreferrer me')
      expect(screen.getByRole('link', { name: 'C' }).getAttribute('rel')).toBeNull()
    })
  })
})
