/**
 * @jest-environment jsdom
 *
 * A-T3e — accessibility harness.
 *
 * Deliberately small. Its job is not component coverage; it is to prove the
 * automated check actually catches violations, which A-T3e requires as
 * evidence: "a harness that has never gone red is not evidence."
 *
 * Scope note — what jsdom can and cannot check:
 *   CAN  structural rules (accessible names, ARIA validity, roles, labels)
 *   CANNOT contrast, target size, or reflow — all three need real layout and
 *          computed styles, which jsdom does not provide. Those belong to the
 *          Playwright side of the harness, which per A-T3e's Q6 decision stays
 *          local rather than running in CI.
 *
 * So the seeded cases below cover the structural rules only. That is a real
 * limit of the CI-side gate, recorded here rather than implied by a green tick.
 */
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

import { Button } from './button'

expect.extend(toHaveNoViolations)

/** A-T3e's failure threshold: serious and critical only. */
const SERIOUS = new Set(['serious', 'critical'])

const seriousViolations = async (container: Element) => {
  const results = await axe(container)
  return results.violations.filter((v) => SERIOUS.has(String(v.impact)))
}

describe('A-T3e accessibility harness', () => {
  describe('seeded violations — the harness must go red', () => {
    it('flags an icon-only control with no accessible name', async () => {
      // Q11: icon-only controls take their name from A05b's icon mapping.
      // Omitting it is the violation this rule exists to prevent.
      const { container } = render(
        <button type="button">
          <svg aria-hidden="true" focusable="false" width="16" height="16" />
        </button>,
      )

      const violations = await seriousViolations(container)
      expect(violations.map((v) => v.id)).toContain('button-name')
    })

    it('flags a form control with no associated label', async () => {
      const { container } = render(<input type="text" />)

      const violations = await seriousViolations(container)
      expect(violations.length).toBeGreaterThan(0)
    })

    it('flags an invalid ARIA attribute value', async () => {
      // Cast is deliberate: TypeScript rejects this at compile time, which is
      // itself a useful guard. The seeded case exists to prove axe catches the
      // same class of error when it arrives from runtime data rather than a
      // literal — which is how it actually reaches production.
      const badAria = { 'aria-expanded': 'not-a-boolean' } as Record<string, string>
      const { container } = render(
        <div role="button" tabIndex={0} {...badAria}>
          Toggle
        </div>,
      )

      const violations = await seriousViolations(container)
      expect(violations.length).toBeGreaterThan(0)
    })
  })

  describe('the same markup, corrected — the harness must go green', () => {
    it('passes once the icon-only control is named', async () => {
      const { container } = render(
        <button type="button" aria-label="Branch from this message">
          <svg aria-hidden="true" focusable="false" width="16" height="16" />
        </button>,
      )

      expect(await seriousViolations(container)).toHaveLength(0)
    })

    it('passes once the input is labelled', async () => {
      const { container } = render(
        <>
          <label htmlFor="workspace-name">Workspace name</label>
          <input id="workspace-name" type="text" />
        </>,
      )

      expect(await seriousViolations(container)).toHaveLength(0)
    })
  })

  describe('real shipped components', () => {
    it('Button has no serious violations', async () => {
      const { container } = render(<Button>Approve and merge</Button>)

      expect(await seriousViolations(container)).toHaveLength(0)
    })

    it('icon-only Button is caught when unnamed, and passes when named', async () => {
      const unnamed = render(
        <Button>
          <svg aria-hidden="true" focusable="false" width="16" height="16" />
        </Button>,
      )
      expect(await seriousViolations(unnamed.container)).not.toHaveLength(0)
      unnamed.unmount()

      const named = render(
        <Button aria-label="Add workspace">
          <svg aria-hidden="true" focusable="false" width="16" height="16" />
        </Button>,
      )
      expect(await seriousViolations(named.container)).toHaveLength(0)
    })
  })
})
