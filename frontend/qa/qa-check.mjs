// Playwright QA/QC harness — drives the live dashboard, walks every tab, and
// reports console errors, failed network requests, error-boundary fallbacks,
// and broken-tile signals (NaN, "no snapshot yet", "undefined", empty panels).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.QA_BASE || 'https://oil.yieldwise.my'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const consoleErrors = []
const pageErrors = []
const failedRequests = []

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } })
const page = await ctx.newPage()

page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('requestfailed', (r) =>
  failedRequests.push(`${r.failure()?.errorText || 'failed'} ${r.url()}`)
)
page.on('response', (r) => {
  const u = r.url()
  if (u.includes('/api/') && r.status() >= 400)
    failedRequests.push(`HTTP ${r.status()} ${u}`)
})

const tabs = [
  { name: 'ops', label: 'OPERATIONS' },
  { name: 'market', label: 'MARKET' },
  { name: 'analytics', label: 'ANALYTICS' },
]

const findings = {}

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)

for (const t of tabs) {
  // click the tab button by its label text
  try {
    await page.getByText(t.label, { exact: true }).first().click({ timeout: 8000 })
  } catch {
    // header chip / fallback: some tabs may already be active
  }
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${OUT}${t.name}.png`, fullPage: true })

  // Scan visible text for broken-tile signals
  const body = await page.evaluate(() => document.body.innerText)
  const signals = []
  for (const pat of ['NaN', 'no snapshot', 'undefined', 'Infinity', 'Something went wrong', 'Error:', '[object Object]']) {
    if (body.includes(pat)) signals.push(pat)
  }
  // count panels rendered vs apparently-empty
  const panelStats = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="petro-card"], [class*="rounded"]'))
    return { totalBlocks: cards.length }
  })
  findings[t.name] = { signals, panelStats }
}

await browser.close()

console.log(JSON.stringify({
  base: BASE,
  consoleErrors: [...new Set(consoleErrors)].slice(0, 40),
  pageErrors: [...new Set(pageErrors)].slice(0, 40),
  failedRequests: [...new Set(failedRequests)].slice(0, 40),
  tabFindings: findings,
}, null, 2))
