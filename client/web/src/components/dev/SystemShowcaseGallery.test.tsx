/**
 * @jest-environment jsdom
 *
 * A-T3d — the gallery is the surface the owner approves the design system
 * from, so a runtime throw or a structural accessibility violation in it must
 * be caught before anyone opens the page.
 */
import { screen, within } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

import { renderWithProviders } from '../../testing/renderWithProviders'
import { SystemShowcaseGallery } from './SystemShowcaseGallery'

expect.extend(toHaveNoViolations)

const SERIOUS = new Set(['serious', 'critical'])
const seriousViolations = async (container: Element) => {
  const results = await axe(container)
  return results.violations.filter((v) => SERIOUS.has(String(v.impact)))
}

describe('SystemShowcaseGallery (A-T3d)', () => {
  beforeAll(() => {
    // jsdom has no layout engine; the panels and command palette observe size.
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
    Element.prototype.scrollIntoView = jest.fn()
  })

  it('renders every section with one h1 and a filled type-scale table', () => {
    renderWithProviders(<SystemShowcaseGallery />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    // Outline is a tree: top-level sections are h2, component subsections h3.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(9)
    // Every id in the document is unique (the swept card renders five times).
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ['type', 'spacing', 'layout', 'conventions', 'components', 'gaps']) {
      expect(document.getElementById(id)?.tagName).toBe('SECTION')
    }

    // The table the gate reads: no cell may be empty. (A review caught a blank
    // line-height column; this is the regression guard.)
    const table = within(document.getElementById('type')!).getAllByRole('table')[0]
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      for (const cell of within(row).getAllByRole('cell')) {
        expect(cell.textContent?.trim()).not.toBe('')
      }
    }
  })

  it('names the radio-group specimen so it is not an unnamed choice group', () => {
    renderWithProviders(<SystemShowcaseGallery />)

    // The per-option labels name "One"/"Two"; only the group's own name says
    // what is being chosen. axe does not flag this, so pin it here.
    expect(screen.getAllByRole('radiogroup', { name: 'Radio group specimen' })).toHaveLength(1)
  })

  it('gives the context-menu specimen a keyboard-reachable trigger', () => {
    renderWithProviders(<SystemShowcaseGallery />)

    // asChild on a plain div leaves no focus semantics, so the specimen never
    // exercises the primitive's Shift+F10 / Menu-key path.
    const trigger = screen.getByRole('button', { name: /Right-click me/ })
    trigger.focus()
    expect(document.activeElement).toBe(trigger)
  })

  it('has no serious accessibility violations beyond the one recorded gap', async () => {
    const { container } = renderWithProviders(<SystemShowcaseGallery />)
    const violations = await seriousViolations(container)

    // Known, recorded on the page and routed to A13: the shipped Combobox
    // trigger (role="combobox") has no accessible name — a combobox cannot be
    // named by its content, and the component exposes no label route. This
    // assertion is exact so a second violation, or a fix, both show up here.
    expect(violations.map((v) => v.id)).toEqual(['button-name'])
    expect(violations[0].nodes).toHaveLength(1)
    expect(violations[0].nodes[0].html).toContain('role="combobox"')
  })
})
