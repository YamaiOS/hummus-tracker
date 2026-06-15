// Verify the global inputs actually drive the UI: vessel search filters the
// table, and the time-range control re-renders charts without errors.
import { chromium } from 'playwright'
const BASE = process.env.QA_BASE || 'https://oil.yieldwise.my'
const errs = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } })
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
page.on('pageerror', e => errs.push(String(e)))
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)

// Count vessel-registry rows before/after a search
const rowsBefore = await page.locator('table tbody tr').count().catch(() => -1)

const search = page.getByPlaceholder(/search vessel/i)
await search.fill('NORTHERN')
await page.waitForTimeout(1500)
const rowsAfter = await page.locator('table tbody tr').count().catch(() => -1)

// Clear, then exercise time-range buttons
await search.fill('')
await page.waitForTimeout(500)
let rangeOk = true
for (const label of ['7D', '30D', '90D', 'ALL']) {
  try {
    await page.getByRole('button', { name: label, exact: true }).first().click({ timeout: 4000 })
    await page.waitForTimeout(600)
  } catch { rangeOk = false }
}

// Vessel class filter
let classOk = true
try {
  await page.getByRole('button', { name: 'VLCC', exact: true }).first().click({ timeout: 4000 })
  await page.waitForTimeout(800)
} catch { classOk = false }

await page.screenshot({ path: new URL('./shots/interact.png', import.meta.url).pathname, fullPage: false })
await browser.close()
console.log(JSON.stringify({
  rowsBefore, rowsAfter,
  searchFilters: rowsAfter >= 0 && rowsAfter < rowsBefore,
  rangeButtonsClickable: rangeOk,
  classFilterClickable: classOk,
  consoleErrors: errs.slice(0, 8),
}, null, 2))
