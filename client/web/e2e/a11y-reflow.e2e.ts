/**
 * A-T3e — viewport / reflow harness.
 *
 * The layout half of the accessibility harness. The jsdom side
 * (`components/ui/accessibility.test.tsx`) covers structural rules — accessible
 * names, ARIA validity, landmarks — but has no layout engine, so it cannot see
 * horizontal overflow, computed size, or what 200% zoom does. Those need a real
 * browser, which is what this file is for.
 *
 * Per A-T3e's Q6 decision this runs locally (`yarn test:e2e`), not in CI:
 * `test:unit` already runs in CI and gates the structural rules at no cost,
 * whereas booting a browser on every push is a permanent tax for a solo project.
 *
 * The seeded cases at the bottom are not ceremony. A-T3e's own words: "a harness
 * that has never gone red is not evidence." They prove the assertions can fail.
 */
import { expect, test, type Page } from '@playwright/test'

/** A-T3e §1 — Tailwind's default set. `lg` is the product's canonical boundary. */
const BREAKPOINTS = [
  { name: 'sm', width: 640 },
  { name: 'md', width: 768 },
  { name: 'lg', width: 1024 },
  { name: 'xl', width: 1280 },
  { name: 'design', width: 1440 }, // A03's desktop canvas; renders in the xl range
] as const

/**
 * 200% zoom on a 1440px window leaves 720 effective CSS px — below `lg`.
 * Emulated by halving the viewport rather than by a real zoom, because CSS px
 * is what layout responds to and Playwright cannot set browser zoom directly.
 * A-T3e §1 records that this narrow state exists whether or not it is designed.
 */
const ZOOM_200_EQUIVALENT = { name: '200% zoom @1440', width: 720 }

/** A-T3e §9 — no page-level horizontal scrolling at any supported width. */
const hasHorizontalOverflow = (page: Page) =>
  page.evaluate(() => {
    const doc = document.documentElement
    // 1px of tolerance: sub-pixel rounding routinely produces a harmless 0.5px.
    return doc.scrollWidth > doc.clientWidth + 1
  })

/** Reports what actually overflowed, so a failure is actionable rather than just red. */
const overflowingElements = (page: Page) =>
  page.evaluate(() => {
    const limit = document.documentElement.clientWidth
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.getBoundingClientRect().right > limit + 1)
      .slice(0, 5)
      .map((el) => {
        const cls = typeof el.className === 'string' ? el.className.slice(0, 60) : ''
        return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`
      })
  })

test.describe('A-T3e reflow — no page-level horizontal overflow', () => {
  for (const { name, width } of [...BREAKPOINTS, ZOOM_200_EQUIVALENT]) {
    test(`${name} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      if (await hasHorizontalOverflow(page)) {
        const culprits = await overflowingElements(page)
        throw new Error(
          `Horizontal overflow at ${width}px. Widest offenders: ${culprits.join(', ') || 'unknown'}`,
        )
      }
    })
  }
})

test.describe('A-T3e harness self-check — these must be able to fail', () => {
  test('a seeded pinned width is detected as overflow', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.evaluate(() => {
      const el = document.createElement('div')
      el.id = '__seeded_overflow'
      el.style.width = '1200px'
      el.style.height = '10px'
      document.body.appendChild(el)
    })

    expect(
      await hasHorizontalOverflow(page),
      'harness failed to detect a 1200px element in a 400px viewport — the check is not working',
    ).toBe(true)

    await page.evaluate(() => document.getElementById('__seeded_overflow')?.remove())
    expect(await hasHorizontalOverflow(page)).toBe(false)
  })

  test('the offender reporter names the element it found', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.evaluate(() => {
      const el = document.createElement('div')
      el.id = '__seeded_named'
      el.className = 'seeded-offender'
      el.style.width = '1200px'
      document.body.appendChild(el)
    })

    expect((await overflowingElements(page)).join(' ')).toContain('seeded-offender')
    await page.evaluate(() => document.getElementById('__seeded_named')?.remove())
  })
})
