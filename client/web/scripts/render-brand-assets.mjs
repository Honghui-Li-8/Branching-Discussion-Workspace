// A08 — render the PNG brand assets from the shipped mark and tokens.
//
// Browsers and social scrapers need PNGs (apple-touch-icon, manifest icons,
// the Open Graph card); the source of truth is public/favicon.svg plus the
// palette in src/index.css. This script draws each asset as a small HTML
// page in Playwright and screenshots it, so the outputs are regenerable and
// no image-processing dependency is added. Re-run after changing the mark,
// the palette or the descriptor, and review the PNGs like code.
//
//   yarn workspace web render:brand-assets
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pub = (p) => resolve(here, '../public', p)

// Palette values mirrored from src/index.css (@theme static). Kept as a
// short explicit table rather than parsing the stylesheet.
const TOKENS = {
  gray900: '#0d1217', // near-black header surface
  gray0: '#ffffff',
  gray25: '#fafbfc',
  gray200: '#d2d9dc',
  tealTint: '#d6edf1',
  tealDefault: '#008ca8',
}
const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
const DESCRIPTOR =
  'A chat tool where you branch off any message into a side conversation, then bring the conclusion back to the main thread.'

const mark = await readFile(pub('favicon.svg'), 'utf8')

/** The mark alone, filling the canvas — for app icons. */
const iconHtml = (size) => `<!doctype html><html><body style="margin:0;background:${TOKENS.tealTint}">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center">
  <div style="width:${size}px;height:${size}px">${mark.replace('width="28" height="28"', `width="${size}" height="${size}"`)}</div>
</div></body></html>`

/** The Open Graph card: near-black surface, mark + wordmark, the descriptor. */
const ogHtml = () => `<!doctype html><html><body style="margin:0;background:${TOKENS.gray900};font-family:${FONT};color:${TOKENS.gray0}">
<div style="box-sizing:border-box;width:1200px;height:630px;padding:96px;display:flex;flex-direction:column;justify-content:space-between">
  <div style="display:flex;align-items:center;gap:28px">
    <div style="width:96px;height:96px">${mark.replace('width="28" height="28"', 'width="96" height="96"')}</div>
    <div style="font-size:72px;font-weight:600;letter-spacing:-0.02em">Trellis</div>
  </div>
  <div>
    <div style="font-size:40px;line-height:1.3;max-width:960px;color:${TOKENS.gray200}">${DESCRIPTOR}</div>
    <div style="margin-top:32px;font-size:26px;color:${TOKENS.tealDefault}">Branch → Explore → Approve → Resume</div>
  </div>
</div></body></html>`

const browser = await chromium.launch()
try {
  const shots = [
    { file: 'icons/apple-touch-icon.png', w: 180, h: 180, html: iconHtml(180) },
    { file: 'icons/icon-192.png', w: 192, h: 192, html: iconHtml(192) },
    { file: 'icons/icon-512.png', w: 512, h: 512, html: iconHtml(512) },
    { file: 'og-image.png', w: 1200, h: 630, html: ogHtml() },
  ]
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 })
    await page.setContent(s.html, { waitUntil: 'load' })
    await page.screenshot({ path: pub(s.file), clip: { x: 0, y: 0, width: s.w, height: s.h } })
    await page.close()
    console.log(`wrote public/${s.file}`)
  }
} finally {
  await browser.close()
}
