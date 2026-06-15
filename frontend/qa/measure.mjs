// Measure every Panel tile per tab: title, rendered height, whether it contains
// a chart (svg/canvas/img), and how much text it has. Flags "oversized-empty"
// tiles (tall but no chart and little text) — the buggy blank tiles.
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || 'https://oil.yieldwise.my'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } })
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

const tabs = [['ops', 'OPERATIONS'], ['market', 'MARKET'], ['analytics', 'ANALYTICS']]
const out = {}

for (const [key, label] of tabs) {
  try { await page.getByText(label, { exact: true }).first().click({ timeout: 8000 }) } catch {}
  await page.waitForTimeout(3000)
  out[key] = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('div.bg-petro-card'))
    return panels.map((p) => {
      const h2 = p.querySelector('h2')
      const r = p.getBoundingClientRect()
      const hasChart = !!p.querySelector('svg, canvas, img, .leaflet-container')
      const txt = (p.innerText || '').replace(/\s+/g, ' ').trim()
      return {
        title: h2 ? h2.innerText.trim() : '(no title)',
        h: Math.round(r.height),
        w: Math.round(r.width),
        chart: hasChart,
        textLen: txt.length,
        oversizedEmpty: r.height > 280 && !hasChart && txt.length < 80,
      }
    }).filter((p) => p.h > 0)
  })
}

await browser.close()
for (const [k, panels] of Object.entries(out)) {
  console.log(`\n=== ${k} ===`)
  for (const p of panels) {
    const flag = p.oversizedEmpty ? '  <-- OVERSIZED-EMPTY' : (!p.chart && p.h > 380 ? '  <-- tall/no-chart' : '')
    console.log(`${String(p.h).padStart(4)}px  chart=${p.chart ? 'Y' : 'N'}  txt=${String(p.textLen).padStart(4)}  ${p.title}${flag}`)
  }
}
