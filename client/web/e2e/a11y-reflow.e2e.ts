/**
 * ADR-0004 (ticket A-T3e) — viewport / reflow harness.
 *
 * The layout half of the accessibility harness. The jsdom side
 * (`components/ui/accessibility.test.tsx`, `App.a11y.test.tsx`) covers
 * structural rules — accessible names, ARIA validity, landmarks — but has no
 * layout engine, so it cannot see horizontal overflow, computed size, or what
 * 200% zoom does. Those need a real browser, which is what this file is for.
 *
 * Runs locally (`yarn test:e2e`) and in CI as a required task of `yarn test`.
 * ADR-0004 records that this was originally kept local-only — the reasoning was that
 * `test:unit` already gated the structural rules in CI and a browser on every
 * push was a tax not worth paying. Reversed 2026-09-06 after five e2e specs sat
 * broken on `main` unnoticed, masking a real product bug.
 *
 * What it measures (A06 re-target, ticket scope addition 2026-09-04):
 *   - every public route, driven from `src/routePaths.ts` — the same table the
 *     router renders, so a new route is measured the day it exists;
 *   - the public shell with its narrow-screen menu open;
 *   - the signed-in workspace shell, which before A06 was measured at ZERO
 *     widths (every case landed on the sign-in surface). CI boots only Vite —
 *     no API, no database — so "signed in" is produced by intercepting the
 *     auth and workspace-list requests, not by a real session. The case
 *     asserts the workspace actually rendered before it measures, so a mock
 *     that silently stopped matching cannot pass as a landing-page measurement.
 *
 * The seeded cases at the bottom are not ceremony. In ADR-0004's words: "a harness
 * that has never gone red is not evidence." They prove the assertions can fail.
 */
import { expect, test, type Page } from '@playwright/test'

import { HEADER_SECTIONS, PATHS, REFLOW_TARGETS, SECTIONS } from '../src/routePaths'

/** ADR-0004 — Tailwind's default set. `lg` is the product's canonical boundary. */
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
 * ADR-0004 records that this narrow state exists whether or not it is designed.
 */
const ZOOM_200_EQUIVALENT = { name: '200% zoom @1440', width: 720 }

const ALL_WIDTHS = [...BREAKPOINTS, ZOOM_200_EQUIVALENT]

/** Below `lg` the public shell collapses its navigation into the sheet menu. */
const LG = 1024

/** ADR-0004 — no page-level horizontal scrolling at any supported width. */
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

const expectNoOverflow = async (page: Page, label: string) => {
  if (await hasHorizontalOverflow(page)) {
    const culprits = await overflowingElements(page)
    throw new Error(
      `Horizontal overflow at ${label}. Widest offenders: ${culprits.join(', ') || 'unknown'}`,
    )
  }
}

/**
 * The signed-in state, without a server. The client asks `GET /auth/me` on
 * bootstrap and `workspacesList` once authenticated; both are answered here.
 * Cross-origin (the API origin differs from Vite's), so the answers carry the
 * CORS headers a credentialed fetch requires.
 */
const mockAuthenticated = async (page: Page) => {
  const cors = (origin: string) => ({
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'content-type': 'application/json',
  })
  const originOf = (url: string) => new URL(url).origin

  await page.route('**/auth/me', (route) => {
    const origin = route.request().headers()['origin'] ?? originOf(route.request().url())
    return route.fulfill({
      status: 200,
      headers: cors(origin),
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'e2e-user',
          authUserId: 'e2e-auth-user',
          email: 'e2e@example.com',
          displayName: 'E2E reviewer',
          creditBalance: 100,
        },
      }),
    })
  })

  await page.route('**/trpc/**', (route) => {
    const origin = route.request().headers()['origin'] ?? originOf(route.request().url())
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors(origin) })
    }
    // Batched tRPC GET: one result per call, in order. Only workspacesList is
    // asked for with no workspace open; an empty list is the honest answer.
    const calls = route.request().url().split('/trpc/')[1]?.split('?')[0]?.split(',') ?? ['']
    return route.fulfill({
      status: 200,
      headers: cors(origin),
      body: JSON.stringify(calls.map(() => ({ result: { data: [] } }))),
    })
  })
}

test.describe('reflow contract (ADR-0004) — public routes', () => {
  for (const target of REFLOW_TARGETS) {
    for (const { name, width } of ALL_WIDTHS) {
      test(`${target.name} at ${name} (${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(target.path)
        await page.waitForLoadState('networkidle')

        // The public shell must actually be what rendered.
        await expect(page.getByRole('banner')).toBeVisible()
        await expectNoOverflow(page, `${target.name} ${width}px`)

        if (width < LG) {
          // Narrow shell: the navigation sheet must not widen the page either.
          await page.getByRole('button', { name: 'Open navigation menu' }).click()
          await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
          await expectNoOverflow(page, `${target.name} ${width}px, menu open`)
          await page.keyboard.press('Escape')
        }
      })
    }
  }
})

test.describe('reflow contract (ADR-0004) — signed-in workspace shell', () => {
  for (const { name, width } of ALL_WIDTHS) {
    test(`workspace at ${name} (${width}px)`, async ({ page }) => {
      await mockAuthenticated(page)
      await page.setViewportSize({ width, height: 900 })
      await page.goto(PATHS.root)
      await page.waitForLoadState('networkidle')

      // Prove the mock took: the workspace shell, not the landing, is on
      // screen. Without this, a mock that stopped matching would measure the
      // landing page and report a green that means nothing.
      await expect(page.getByRole('heading', { name: /opening or creating a workspace/i })).toBeVisible()
      await expect(page.getByRole('banner')).toHaveCount(0)

      await expectNoOverflow(page, `workspace ${width}px`)
    })
  }
})

test.describe('section deep-links (A06) — scroll and focus, across routes', () => {
  test('a section link on /login lands on /, scrolls to the section and focuses it', async ({
    page,
  }) => {
    // Short viewport so the section is off-screen until scrolled to.
    await page.setViewportSize({ width: 1280, height: 400 })
    await page.goto(PATHS.login)
    await page.waitForLoadState('networkidle')

    // The header shows the in-nav subset only; footer-only sections have their own loop below.
    const target = HEADER_SECTIONS[HEADER_SECTIONS.length - 1]
    await page.getByRole('banner').getByRole('link', { name: target.label }).click()

    await expect(page).toHaveURL(new RegExp(`${PATHS.root}#${target.id}$`))
    await expect(page.locator(`#${target.id}`)).toBeFocused()
    // The page scrolled, and the section is inside the viewport. (Not "at the
    // top": the last section on a short page cannot reach it.)
    const { scrollY, top, viewportHeight } = await page.locator(`#${target.id}`).evaluate((el) => ({
      scrollY: window.scrollY,
      top: el.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
    }))
    expect(scrollY, 'page should have scrolled toward the section').toBeGreaterThan(0)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top).toBeLessThan(viewportHeight)
  })

  test('a section link on the landing page itself focuses the section', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 })
    await page.goto(PATHS.root)
    await page.waitForLoadState('networkidle')

    const target = SECTIONS[0]
    await page.getByRole('contentinfo').getByRole('link', { name: target.label }).click()
    await expect(page.locator(`#${target.id}`)).toBeFocused()
  })
})

test.describe('reflow harness self-check (ADR-0004) — these must be able to fail', () => {
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

test.describe('landing content (A07) — the visual loads and every anchor focuses its section', () => {
  test('the hero image decodes and carries its alt text', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(PATHS.root)
    await page.waitForLoadState('networkidle')

    const img = page.getByRole('img', { name: /project decision/i })
    await expect(img).toBeVisible()
    // A broken path renders an alt-text box with naturalWidth 0; this is the assertion that catches it.
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  })

  for (const section of SECTIONS) {
    test(`footer link "${section.label}" scrolls to and focuses #${section.id}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 500 })
      await page.goto(PATHS.root)
      await page.waitForLoadState('networkidle')

      await page.getByRole('contentinfo').getByRole('link', { name: section.label }).click()
      await expect(page.locator(`#${section.id}`)).toBeFocused()
      const { top, viewportHeight } = await page
        .locator(`#${section.id}`)
        .evaluate((el) => ({ top: el.getBoundingClientRect().top, viewportHeight: window.innerHeight }))
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top).toBeLessThan(viewportHeight)
    })
  }
})

test.describe('identity assets (A08) — the favicon and social image resolve', () => {
  for (const asset of ['/favicon.svg', '/og-image.png', '/icons/apple-touch-icon.png', '/site.webmanifest']) {
    test(`${asset} is served`, async ({ request }) => {
      const response = await request.get(asset)
      expect(response.status()).toBe(200)
    })
  }

  test('the document head declares the description, icon and Open Graph image', async ({ page }) => {
    await page.goto(PATHS.root)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /branch off any message/)
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
    // Absolute, whatever the origin: scrapers discard relative image URLs.
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\/[^/]+\/og-image\.png$/)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /^https?:\/\/[^/]+\/$/)
  })
})
