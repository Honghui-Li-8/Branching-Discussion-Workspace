import * as fs from 'node:fs'
import * as path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

// Minimal tRPC mock. The MarkdownE2EHarness annotation section uses a UUID
// messageId, which triggers a messageAnnotationsByMessage query. Return an
// empty list so the annotation wrapper initialises cleanly without network
// errors during rendering-only tests.
const installMinimalTrpcMock = async (page: Page) => {
  await page.route('**/trpc/**', async (route) => {
    const url = new URL(route.request().url())
    const isBatch = url.searchParams.get('batch') === '1'

    const marker = '/trpc/'
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex < 0) {
      await route.fallback()
      return
    }

    const procedurePath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
    const procedureNames = procedurePath.split(',').filter(Boolean)

    const responses = procedureNames.map((name) => {
      if (name === 'messageAnnotationsByMessage') {
        return { result: { data: [] } }
      }
      return { result: { data: null } }
    })

    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(isBatch ? responses : responses[0]),
    })
  })
}

const gotoMarkdownFixture = async (page: Page) => {
  await page.goto('/e2e.html?fixture=markdown')
  await expect(page.getByTestId('e2e-page-title')).toBeVisible()
}

const saveScreenshot = async (page: Page, filename: string) => {
  const dir = path.join('client/web/e2e/screenshots')
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, filename) })
}

test.describe('assistant markdown rendering', () => {
  let pageErrors: Error[]

  test.beforeEach(async ({ page }) => {
    pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(err))
    await installMinimalTrpcMock(page)
    await gotoMarkdownFixture(page)
  })

  // ── Fixture reachability ─────────────────────────────────────────────────

  test('markdown fixture is reachable at ?fixture=markdown', async ({ page }) => {
    await expect(page.getByTestId('e2e-page-title')).toHaveText('Markdown Rendering Fixture')
    expect(pageErrors).toHaveLength(0)
  })

  test('existing annotation harness is still reachable at /e2e.html', async ({ page }) => {
    await page.goto('/e2e.html')
    await expect(page.getByTestId('e2e-page-title')).toHaveText('Annotation E2E Harness')
  })

  // ── Ordered lists ────────────────────────────────────────────────────────

  test('ordered list renders as one ol with three li children', async ({ page }) => {
    const section = page.getByTestId('fixture-ordered-list')
    await expect(section.locator('ol')).toHaveCount(1)
    await expect(section.locator('ol > li')).toHaveCount(3)

    // Computed list-style-type must be decimal — guards against Tailwind
    // preflight resetting list-style: none inside @layer base.
    const listStyleType = await page.evaluate(() => {
      const ol = document.querySelector('[data-testid="fixture-ordered-list"] ol')
      return ol ? window.getComputedStyle(ol).listStyleType : null
    })
    expect(listStyleType).toBe('decimal')

    // Screenshot for visual marker-numbering evidence. List markers are CSS
    // ::marker pseudo-elements and cannot be read as DOM text nodes, so a
    // screenshot is the primary confirmation that 1 / 2 / 3 are visible.
    // Evidence stored at: client/web/e2e/screenshots/ordered-list-markers.png
    await saveScreenshot(page, 'ordered-list-markers.png')
  })

  test('repeated 1. input produces one contiguous ol', async ({ page }) => {
    const section = page.getByTestId('fixture-repeated-one-list')
    await expect(section.locator('ol')).toHaveCount(1)
    await expect(section.locator('ol > li')).toHaveCount(3)
  })

  // ── Code fence fallback ──────────────────────────────────────────────────

  test('unknown-language code fence renders without page errors', async ({ page }) => {
    const section = page.getByTestId('fixture-code-unknown')
    await expect(section.locator('pre')).toHaveCount(1)
    await expect(section.locator('pre code')).toHaveCount(1)
    expect(pageErrors).toHaveLength(0)
  })

  test('no-language code fence renders as readable pre block', async ({ page }) => {
    const section = page.getByTestId('fixture-code-plain')
    await expect(section.locator('pre')).toHaveCount(1)
    await expect(section.locator('pre code')).toHaveCount(1)
    expect(pageErrors).toHaveLength(0)
  })

  // ── Raw HTML safety ──────────────────────────────────────────────────────

  test('raw HTML does not become live DOM', async ({ page }) => {
    const section = page.getByTestId('fixture-raw-html')

    // No live <script> elements inside assistant content.
    await expect(section.locator('script')).toHaveCount(0)

    // Scope every element assertion to the inside of .model-markdown. ModelMarkdown's
    // own container carries an inline style (style={{ overflowWrap: 'anywhere' }}), so a
    // section-wide `div[style]` locator always resolves to that wrapper and can never
    // reach 0 — it measured component chrome, not rendered Markdown output.
    //
    // ModelMarkdown only emits a nested <div> for tables (the overflow-x-auto wrapper),
    // and MD_RAW_HTML contains no table, so any <div> inside the container would mean the
    // raw `<div style="color: red">` input became live DOM.
    await expect(section.locator('.model-markdown div')).toHaveCount(0)
    await expect(section.locator('.model-markdown div[style]')).toHaveCount(0)

    // Same check for the raw <strong> input: MD_RAW_HTML has no Markdown emphasis, so a
    // live <strong> here could only come from raw HTML being parsed.
    await expect(section.locator('.model-markdown strong')).toHaveCount(0)

    // The raw HTML tags should appear as escaped visible text, not as elements.
    await expect(section).toContainText('<script>')
    await expect(section).toContainText('<div')
    await expect(section).toContainText('<strong>')

    expect(pageErrors).toHaveLength(0)
  })

  // ── Image Markdown policy ────────────────────────────────────────────────

  test('image markdown never renders an img element or src attribute', async ({ page }) => {
    const section = page.getByTestId('fixture-image')
    await expect(section.locator('img')).toHaveCount(0)
    await expect(section.locator('[src]')).toHaveCount(0)
  })

  test('safe image URL with alt renders as Image: {alt} anchor', async ({ page }) => {
    const section = page.getByTestId('fixture-image')
    const link = section.locator('a', { hasText: 'Image: A diagram' })
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute('href', 'https://example.com/image.png')
  })

  test('safe image URL without alt renders as Image anchor', async ({ page }) => {
    const section = page.getByTestId('fixture-image')
    // The "Image" anchor must not contain a colon (to distinguish from "Image: A diagram").
    const link = section.locator('a').filter({ hasText: /^Image$/ })
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute('href', 'https://example.com/no-alt.png')
  })

  test('unsafe image URL with alt renders as plain text span, not anchor', async ({ page }) => {
    const section = page.getByTestId('fixture-image')
    await expect(section.locator('span', { hasText: 'Image: Suspicious image' })).toHaveCount(1)
    await expect(section.locator('a[href^="javascript:"]')).toHaveCount(0)
  })

  test('unsafe image URL without alt is omitted entirely', async ({ page }) => {
    const section = page.getByTestId('fixture-image')
    // javascript:void(0) image with no alt should produce nothing — no element.
    // We verify indirectly: total anchors = 2 (safe+alt, safe+no-alt) and
    // the only span is the unsafe+alt one.
    await expect(section.locator('a')).toHaveCount(2)
  })

  // ── Anchor URL policy ────────────────────────────────────────────────────

  test('http, https, and mailto links are rendered as clickable anchors', async ({ page }) => {
    const section = page.getByTestId('fixture-links')
    await expect(section.locator('a[href="http://example.com"]')).toHaveCount(1)
    await expect(section.locator('a[href="https://example.com"]')).toHaveCount(1)
    await expect(section.locator('a[href="mailto:test@example.com"]')).toHaveCount(1)
  })

  test('relative and unsafe-protocol links render as non-clickable spans', async ({ page }) => {
    const section = page.getByTestId('fixture-links')

    // No <a> with a relative href.
    await expect(section.locator('a[href="/about"]')).toHaveCount(0)
    // No <a> with a javascript: href.
    await expect(section.locator('a[href^="javascript:"]')).toHaveCount(0)

    // The link text must still appear as visible text inside spans.
    await expect(section.locator('span', { hasText: 'Relative link' })).toHaveCount(1)
    await expect(section.locator('span', { hasText: 'Unsafe protocol' })).toHaveCount(1)
  })

  // ── Narrow-width containment ─────────────────────────────────────────────

  test('code blocks do not overflow at 360px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.reload()
    await expect(page.getByTestId('e2e-page-title')).toBeVisible()

    const overflows = await page.evaluate(() => {
      const pres = document.querySelectorAll('.model-markdown pre')
      return Array.from(pres).some(
        (el) => el.getBoundingClientRect().width > window.innerWidth + 1,
      )
    })
    expect(overflows).toBe(false)
  })

  test('tables do not overflow at 360px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.reload()
    await expect(page.getByTestId('e2e-page-title')).toBeVisible()

    const overflows = await page.evaluate(() => {
      const wrappers = document.querySelectorAll('.model-markdown .overflow-x-auto')
      return Array.from(wrappers).some(
        (el) => el.getBoundingClientRect().width > window.innerWidth + 1,
      )
    })
    expect(overflows).toBe(false)
  })
})
