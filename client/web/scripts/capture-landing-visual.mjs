// A07 — capture the landing page's product visual from the real product.
//
// The landing hero shows a screenshot of the seeded intro workspace ("Project
// Decision"), not an illustration. This script produces that image so it can
// be regenerated whenever the tree or its cards are restyled, and reviewed as
// a committed artefact like any other change.
//
// Local only. It needs both dev servers running with the local auth bypass
// configured (see client/web/.env.example): the API on :3001 and Vite on the
// URL below. CI never runs it — there is no API there.
//
//   yarn workspace web capture:landing-visual
//   LANDING_CAPTURE_URL=http://localhost:5190 yarn workspace web capture:landing-visual
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { stat } from 'node:fs/promises'

const baseUrl = process.env.LANDING_CAPTURE_URL ?? 'http://localhost:5173'
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/landing/intro-workspace-tree.png')
const WORKSPACE_TITLE = /Project Decision/
const ROOT_TOPIC = 'Should I build this project now?'
const PADDING = 28

const browser = await chromium.launch()
try {
  // Large enough that the whole seeded tree renders without the canvas scrolling;
  // anything scrolled out of view would be missing from the capture.
  const page = await browser.newPage({ viewport: { width: 2400, height: 1400 }, deviceScaleFactor: 2 })
  await page.goto(`${baseUrl}/login`)
  await page.getByRole('button', { name: /continue as local developer/i }).click()
  // The bypass user auto-imports the intro workspace on first sign-in (A00c).
  const workspace = page.getByRole('button', { name: WORKSPACE_TITLE }).first()
  await workspace.waitFor({ timeout: 15_000 })
  await workspace.click()
  await page.getByText(ROOT_TOPIC, { exact: true }).first().waitFor({ timeout: 15_000 })
  await page.waitForLoadState('networkidle')
  // Let the tree layout settle (card measurement runs after mount).
  await page.waitForTimeout(600)

  // Clip to the cards, not the canvas: the union of every topic card (each is
  // an <article>), plus room on the right for the folded-count pills.
  const boxes = await page.locator('main article').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    }),
  )
  if (boxes.length === 0) throw new Error('no topic cards found — is the intro workspace rendered?')
  const x0 = Math.min(...boxes.map((b) => b.x)) - PADDING
  const y0 = Math.min(...boxes.map((b) => b.y)) - PADDING
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + PADDING + 24
  const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + PADDING
  await page.screenshot({
    path: out,
    animations: 'disabled',
    clip: { x: Math.max(0, x0), y: Math.max(0, y0), width: x1 - Math.max(0, x0), height: y1 - Math.max(0, y0) },
  })
  const { size } = await stat(out)
  console.log(`wrote ${out} (${Math.round(size / 1024)} KB, ${boxes.length} cards)`)
} finally {
  await browser.close()
}
