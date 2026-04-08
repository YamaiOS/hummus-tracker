# UAT Report — Hummus Tracker (Cross-Browser QA)

**Date:** 2026-04-08
**Targets:** https://hummus-trackerz.fly.dev | https://oil.yieldwise.my
**Testers:** 4 parallel QA agents
- iPhone 14 Pro Safari (390×844)
- Pixel 7 Chrome Android (412×915)
- Desktop Chrome (1920×1080)
- Desktop Safari macOS (1440×900)

---

## 1. Executive Summary

| Severity | Count | Notes |
|:---|:---|:---|
| **CRITICAL** | 4 | Map collapse in Safari, Flow KPI displays wrong value, Activity feed empty, Morning Brief renders raw markdown |
| **HIGH** | 14 | Tab overflow on mobile, dead EXPORT button, OPEC false zeros, FRED price gap, date parse bug, ISO date timezone shift |
| **MEDIUM** | 18 | Sticky offsets, scroll affordances, table overflow, font fallback, panel layout |
| **LOW** | 11 | Cosmetic, copy polish, performance hints |

**Verdict:** Phase 4 fixes (Fujairah, Disruption Timeline, R&D banner) are confirmed working. However, **VesselMap collapses on Safari** (both desktop and iPhone) is a deploy-blocker, and several **logic bugs** in the Dashboard KPIs/Brief are visible to any first-time user.

---

## 2. CRITICAL Issues

### C1 — VesselMap collapses to 0px on Safari (iOS + macOS)
- **Files:** `VesselMap.tsx:89,98`, `Dashboard.tsx:407` (Panel)
- **Reported by:** iPhone Safari, Desktop Safari
- The Leaflet `MapContainer` uses `h-full w-full` inside a `flex-grow` Panel parent with no explicit height. WebKit refuses to resolve `height: 100%` against a flex item with no definite height. The `min-h-[400px]` saves the wrapper but `MapContainer` itself collapses, leaving the tile layer invisible.
- **Fix:** Set `MapContainer style={{ height: 400 }}` or change wrapper to `h-[400px]` instead of `h-full min-h-[400px]`.

### C2 — Flow (mbpd) KPI displays EIA baseline (20.0), not observed flow (0.0)
- **File:** `Dashboard.tsx:160`
- **Reported by:** Desktop Chrome
- Hardcoded `baseline?.eia_baseline_mbpd ?? 20.0`. Always reads "20.0 mbpd" even when `/api/flow/estimate` returns `0.0`. Directly contradicts the RED status banner ("Flow at 0% of baseline").
- **Fix:** Use `estimate?.estimated_mbpd` from `/api/flow/estimate`. Show baseline as a sub-label only.

### C3 — Activity Feed renders empty silently (`/api/activity` returns `[]`)
- **File:** `ActivityFeed.tsx`
- **Reported by:** Desktop Chrome
- Panel title "Intelligence feed & anomaly log" promises content, but with sparse AIS the feed is permanently empty and no fallback message is shown.
- **Fix:** Add `"No activity logged in last 24h"` empty state.

### C4 — Morning Brief renders markdown as raw monospace text
- **File:** `IntelligenceBriefPanel.tsx:37`
- **Reported by:** Desktop Chrome
- API returns markdown with `#`, `**`, `>`, `###`, emoji. UI uses `whitespace-pre-wrap font-mono` so user sees `# 🌅 Hormuz Intelligence Brief — 2026-04-08` as literal text. The brief is the most narrative-rich element of the product — rendering it raw undermines the entire presentation.
- **Fix:** Add `react-markdown` or `marked` to parse the brief content.

---

## 3. HIGH Severity Issues

### H1 — Tab strip overflows mobile viewport (412px Android, 390px iPhone)
- **File:** `Dashboard.tsx:176–195`
- **Reported by:** Android Chrome, iPhone Safari
- 3 buttons × ~140px each = ~420px > 390–412px viewport. Causes horizontal page scroll or clipping.
- **Fix:** `w-full` outer + `flex-1` per button on mobile.

### H2 — Tab buttons below 44px tap target minimum
- **File:** `Dashboard.tsx:341` (`py-2` = ~36px)
- **Reported by:** iPhone Safari, Android Chrome
- **Fix:** `py-3 min-h-[44px]`.

### H3 — VesselTable `min-w-[1000px]` forces 9-col horizontal scroll on mobile
- **File:** `VesselTable.tsx:31`
- **Reported by:** iPhone Safari
- 9 dense columns scrolling on a 390px screen is unusable.
- **Fix:** Hide non-essential cols on mobile via `hidden sm:table-cell`.

### H4 — EXPORT RAW (TXT) button is a dead `<button>` with no onClick
- **File:** `IntelligenceBriefPanel.tsx:31–33`
- **Reported by:** Desktop Chrome, iPhone Safari
- Procurement evaluators testing export workflows will lose confidence.
- **Fix:** Either wire up Blob download or remove the button.

### H5 — OPEC compliance shows false-zero observed values for all countries
- **File:** `OPECCompliancePanel.tsx`
- **Reported by:** Desktop Chrome
- The "Insufficient AIS coverage" gold warning fires correctly, but the table still renders Saudi Arabia, Iraq, UAE, Kuwait at `0.00` observed. New users who don't read the warning think OPEC stopped exporting.
- **Fix:** When `hasInsufficientData`, render `—` or `N/A` in observed/delta columns instead of `0.00`.

### H6 — FRED Brent ($121.88) vs ICE futures ($93.99) — unexplained $28 gap
- **File:** `Dashboard.tsx:82–106`, `services/fred.py`
- **Reported by:** Desktop Chrome
- FRED is 9 days stale (latest 2026-03-30). The dual-price display works, but a 23% spread between spot and futures looks like a data integrity bug to a trader.
- **Fix:** Add tooltip explaining "FRED publishes with 1–5 day lag; futures show real-time market." Consider hiding FRED when staleness > 5 days.

### H7 — Strait Health Score logic mismatch
- **File:** `services/status.py`
- **Reported by:** Desktop Chrome
- Score = 58% RED with summary "Recent geopolitical disruption", but the only cited disruption is "Increased Patrol Activity" (0.3% Brent impact, low severity). Score is driven by zero-AIS, but text blames geopolitics.
- **Fix:** Score logic should weight AIS sparsity vs disruption signals separately, with summary text reflecting the actual driver.

### H8 — `/api/congestion/latest` returns empty body (broken endpoint)
- **File:** `routers/congestion.py`, startup task in `main.py`
- **Reported by:** Desktop Chrome
- `PortCongestionPanel` exists in code but is **not rendered in any tab** — dead code + broken API shipped together.
- **Fix:** Either fix the endpoint and wire up the panel, or remove both.

### H9 — ISO date string `new Date('2026-04-08')` parses as UTC midnight
- **Files:** `PriceChart.tsx:47,81`, `TransitChart.tsx:40,61`, `DisruptionTimeline.tsx:27,47,104`, `DailyFlowTrend.tsx:32`
- **Reported by:** Desktop Safari
- In timezones east of UTC (e.g., Asia/Kuala_Lumpur, UTC+8), every X-axis label is shifted **one day earlier**. Silent data integrity bug.
- **Fix:** Replace `new Date(d)` with `new Date(d + 'T00:00:00')` or use `date-fns/parseISO`.

### H10 — Leaflet zoom controls 26×26px (untappable on iOS, below 44px minimum)
- **File:** `VesselMap.tsx:95`
- **Reported by:** iPhone Safari
- **Fix:** `zoomControl={false}` and rely on pinch-zoom, or render custom 44px controls.

### H11 — VesselMap legend + stats overlay consume ~30% of map area on mobile
- **File:** `VesselMap.tsx:202,231`
- **Reported by:** iPhone Safari
- Both `absolute` overlays (legend bottom-left, stats top-right) block the Strait of Hormuz lanes on a 390×400 map.
- **Fix:** Render legend/stats below the map at mobile widths.

### H12 — Leaflet pan gesture conflicts with page scroll on Android
- **File:** `VesselMap.tsx`
- **Reported by:** Android Chrome
- Chrome aggressively claims vertical scroll before Leaflet can pan, causing frustrating UX.
- **Fix:** Add a "Tap to interact" overlay that enables `pointer-events` only after first tap.

### H13 — DisruptionTimeline meta row missing `flex-wrap`
- **File:** `DisruptionTimeline.tsx:63`
- **Reported by:** iPhone Safari
- When both "Recent" badge and category label are present, the row overflows on narrow screens.
- **Fix:** Add `flex-wrap` to the meta row (was removed during the previous Safari fix — needs to be re-added without breaking baseline alignment).

### H14 — ActivityFeed nested scroll missing `WebkitOverflowScrolling`
- **File:** `ActivityFeed.tsx:28`
- **Reported by:** iPhone Safari, Android Chrome
- DisruptionTimeline has it; ActivityFeed doesn't. Inconsistent momentum scroll on iOS < 13.
- **Fix:** `style={{ WebkitOverflowScrolling: 'touch' }}`.

---

## 4. MEDIUM Severity Issues

| # | File:Line | Issue |
|:---|:---|:---|
| M1 | `StraitStatusBanner.tsx:32` | `sticky top-[57px]` hardcodes header height; breaks with R&D banner above (real stack ≈ 88px) and Safari dynamic address bar |
| M2 | `Dashboard.tsx:62–69` | R&D banner not in sticky stack; makes M1 worse |
| M3 | `Dashboard.tsx:153` | 7 KPIs in `grid-cols-2` produces an orphan card on mobile — visually inconsistent |
| M4 | `Dashboard.tsx:120` | Connection status label `hidden sm:inline` — mobile users see only the dot with no context |
| M5 | `index.html:10` + `VesselMap.tsx:12` | Leaflet CSS loaded **twice** (CDN + Vite import). Safari flash of unstyled map. Remove the CDN link |
| M6 | `VesselTable.tsx:30,33` | `sticky` thead inside `overflow-x-auto` fails in Safari (well-documented bug). Remove the sticky or restructure scroll containers |
| M7 | `TransitChart.tsx:26–33`, `MarketMetricsPanel.tsx:95`, `DailyFlowTrend.tsx:59` | SVG `linearGradient` IDs are document-global. Use `useId()` or per-component suffixes |
| M8 | `MarketMetricsPanel.tsx:53–55` | `items-baseline` with mixed mono/sans fonts misaligns by 1–2px in Safari |
| M9 | `IntelligenceBriefPanel.tsx:37` | `whitespace-pre-wrap` + `break-words` overflows horizontally on Safari with long LLM lines |
| M10 | `OPECCompliancePanel.tsx:42` | 4-col table with `px-1` too tight at 390px |
| M11 | `PriceChart.tsx:41` | `margin: { left: -20 }` clips Y-axis tick labels on mobile |
| M12 | `MarketMetricsPanel.tsx:49` | `gap-8` + `text-3xl` + BACKWARDATION label crowds at 390px |
| M13 | `MarketMetricsPanel.tsx:48` | `space-y-6` wrapper missing `w-full` — potential 0-width chart on mount |
| M14 | `Dashboard.tsx:220` | 4 ops panels stack to 1-col on mobile — long scroll wall |
| M15 | `Dashboard.tsx` | No `React.lazy` or code splitting — all Recharts panels load on initial bundle (~926KB) |
| M16 | `VesselMap.tsx:178` | Leaflet popup `min-w-[180px]` can escape viewport at edges; needs `autoPanPadding` |
| M17 | `ActivityFeed.tsx:28`, `DisruptionTimeline.tsx:35` | Custom scrollbar invisible on iOS Safari — no scroll affordance. Add bottom gradient fade |
| M18 | `services/efs` | Dubai estimated as `Brent − $2.10` in `/api/prices/market-metrics`. EFS spread is circular; methodology not disclosed in UI |

---

## 5. LOW Severity / Polish

| # | File | Issue |
|:---|:---|:---|
| L1 | `Dashboard.tsx:63` | R&D banner span lacks `flex-wrap` — overflow on iPhone SE (375px) |
| L2 | `Dashboard.tsx:366` | SIM badge `absolute top-2 right-2` overlaps long KPI values; add `pr-8` |
| L3 | `BunkerPricesPanel.tsx:35` | "HI-5 SPREAD" label tight in 3-col grid at 390px |
| L4 | `VolumeByFlag.tsx:29` | Long flag names push barrel count off-screen — add `min-w-0 truncate` |
| L5 | `index.html:8` | Missing `preconnect` for `fonts.gstatic.com` (only `googleapis.com` is preconnected) |
| L6 | `index.html:9`, `tailwind.config.js:27` | JetBrains Mono → SF Mono fallback causes FOUT layout reflow in dual Brent header |
| L7 | `Dashboard.tsx:55`, `StraitStatusBanner.tsx:39` | `animate-pulse` on sticky element creates compositing layers — scroll jank on Safari |
| L8 | `StraitStatusBanner.tsx:35` | `bg-opacity-5` is Tailwind v2; no-op in v3 — pill loses transparency |
| L9 | `Dashboard.tsx:323` | Footer credit "Syazwan Naim Research & Development" reads as personal project, not vendorable product |
| L10 | `weather` | `wave_height_m: null` for all 4 terminals — should display `—` not blank |
| L11 | absent | No PWA manifest / service worker / `theme-color` — no offline shell for commute use |

---

## 6. Confirmed Working (Phase 4 fixes verified)

| Feature | Status |
|:--|:--|
| Fujairah Inventory chart (Safari iPhone) | ✅ Explicit `h-[200px]` resolves |
| Bunker Prices chart (Safari iPhone) | ✅ Explicit `h-[200px]` resolves |
| R&D PREVIEW banner copy | ✅ Streamlined |
| LIMITED AIS COVERAGE banner | ✅ Fires correctly when tankers < 5 |
| Disruption Timeline stacked layout | ✅ Title/meta no longer overlap |
| `WebkitOverflowScrolling` on timeline | ✅ Smooth iOS momentum |
| TS / Vite build | ✅ Clean |
| Dual Brent display logic | ✅ Both prices shown (data quality is a separate issue) |

---

## 7. Recommended Fix Order

### P0 — Deploy blockers (must fix before any external demo)
1. **C1** VesselMap height collapse on Safari
2. **C2** Flow KPI shows wrong value
3. **C4** Morning Brief markdown rendering
4. **H1** Tab strip mobile overflow
5. **H4** Dead EXPORT button (remove or wire up)
6. **H5** OPEC false-zero observed values

### P1 — High-visibility UX/data fixes
7. **C3** Activity feed empty state
8. **H2** Tab tap targets
9. **H3** VesselTable mobile column hiding
10. **H6** FRED staleness explanation
11. **H7** Strait Health Score summary text
12. **H9** ISO date timezone bug
13. **H13** DisruptionTimeline flex-wrap

### P2 — Polish & infrastructure
14. **H8** Remove dead congestion endpoint OR fix it
15. **H10–12** VesselMap mobile interactions
16. **M1–M2** Sticky stack offset
17. **M5** Remove duplicate Leaflet CSS
18. **M7** SVG gradient ID collisions
19. **M15** Code split tabs

### P3 — Cosmetic
20. All LOW items as time permits

---

## 8. Sign-off

**Cross-browser verdict:** **CONDITIONAL PASS** — the Phase 4 mobile fixes hold, but new issues surfaced from a thorough trader workflow simulation:

- **Desktop Chrome** is most usable but exposes the **logic bugs** (Flow KPI, Morning Brief, OPEC zeros).
- **Desktop Safari** exposes **rendering bugs** (date parse, sticky offsets, gradient IDs).
- **iPhone Safari** exposes **layout collapse** (map) and **touch target failures**.
- **Android Chrome** exposes **tab overflow** and **Leaflet gesture conflicts**.

**Not ready** for paid trial or external demo until at least P0 items are resolved. Estimated 4–6 hours of focused work to clear the P0 list.
