// Detect overlapping panels at several viewport widths.
import { chromium } from 'playwright'
const BASE = process.env.QA_BASE || 'https://oil.yieldwise.my'
const widths = [1440, 1280, 1024, 900, 820, 768]
const browser = await chromium.launch()

for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 1400 } })
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const overlaps = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('div.bg-petro-card')).map((p) => {
      const r = p.getBoundingClientRect()
      const h2 = p.querySelector('h2')
      return { title: h2 ? h2.innerText.trim() : '(none)', x: r.x, y: r.y, w: r.width, h: r.height }
    }).filter((p) => p.w > 50 && p.h > 30)
    const out = []
    for (let i = 0; i < panels.length; i++) {
      for (let j = i + 1; j < panels.length; j++) {
        const a = panels[i], b = panels[j]
        const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
        const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
        if (ox > 24 && oy > 24) out.push(`${a.title} ⨯ ${b.title} (ox=${Math.round(ox)} oy=${Math.round(oy)})`)
      }
    }
    return out
  })
  console.log(`width ${w}: ${overlaps.length ? overlaps.join(' | ') : 'no overlaps'}`)
  if (w === 1280) await page.screenshot({ path: new URL('./shots/w1280.png', import.meta.url).pathname, fullPage: true })
  await page.close()
}
await browser.close()
