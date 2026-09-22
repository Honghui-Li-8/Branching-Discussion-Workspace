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

// A08b — the crop is a named set of topics, not the tree's bounding box, so the
// framing is a reviewed choice and stays stable when the seed grows. Owner pick
// (checkpoint 1, crop C): the root's three Exploring branches plus the two
// Approved topics beside them — roughly 1.66:1, which reads at hero width and
// balances the copy column. The root card and the depth-3 card to its right are
// deliberately outside it.
const CROP_TOPICS = [
  'Personal value vs team value',
  'Will this create strong interview signal?',
  'Execution and sustainability risks',
  'Personal productivity gain',
  'Visibility of decision process artifact',
]

const browser = await chromium.launch()
try {
  // Large enough that every *unfolded* card renders without the canvas scrolling
  // (the seed has 35 topics; most sit folded behind the "+N" pills, so seven cards
  // show). Anything scrolled out of view would be missing from the capture.
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

  // Clip to the cards, not the canvas: the union of the CROP_TOPICS cards (each
  // topic is an <article> titled by its h3), plus room on the right for the
  // folded-count pills, which sit outside the card box.
  const found = await page.locator('main article').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { title: el.querySelector('h3')?.textContent?.trim() ?? '', x: r.left, y: r.top, w: r.width, h: r.height }
    }),
  )
  if (found.length === 0) throw new Error('no topic cards found — is the intro workspace rendered?')
  // Loudly, not silently: a reseeded or refolded tree must not quietly crop to
  // whatever happens to be on screen.
  const missing = CROP_TOPICS.filter((t) => !found.some((c) => c.title === t))
  if (missing.length > 0) {
    throw new Error(`crop topics missing from the rendered tree: ${missing.map((t) => `"${t}"`).join(', ')}`)
  }
  const boxes = found.filter((c) => CROP_TOPICS.includes(c.title))
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
  console.log(
    `wrote ${out} (${Math.round(size / 1024)} KB, ${boxes.length} of ${found.length} cards, ` +
      `${Math.round(x1 - Math.max(0, x0))}×${Math.round(y1 - Math.max(0, y0))} CSS px)`,
  )
} finally {
  await browser.close()
}
