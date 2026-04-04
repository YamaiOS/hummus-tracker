# Hummus Tracker — UI/UX Overhaul Spec

## Design Direction

Petronas / Malaysian energy corporate. Think Bloomberg terminal meets Petronas annual report.
Confident, data-dense, zero fluff. A trader should be able to read this dashboard on a 27" monitor
across the room. Every pixel earns its place.

**This is a reskin — do NOT change any data fetching, API calls, or component logic. Only change
styling, layout, and remove decorative elements.**

---

## Brand Tokens

### Colors

```
--bg-primary:       #0a1628       /* deep petroleum dark — main background */
--bg-card:          #0f1d32       /* card/panel background — solid, no transparency */
--bg-card-hover:    #142540       /* subtle hover state */
--border:           #1c2e4a       /* card borders — visible but quiet */
--border-accent:    #2a4060       /* stronger borders for active/focused panels */

--text-primary:     #e8e4df       /* warm white — body text */
--text-secondary:   #8b9bb4       /* muted descriptions, labels */
--text-tertiary:    #566b8a       /* least important text */

--accent-teal:      #00a19c       /* Petronas teal — primary accent, links, active states */
--accent-teal-dim:  #007a76       /* teal for backgrounds/fills */
--accent-gold:      #c4a35a       /* alerts, warnings, important numbers — use sparingly */
--accent-red:       #c4463a       /* critical alerts only — dark vessels, disruptions */
--accent-green:     #2d8a6e       /* positive states — normal flow, compliant */

--font-mono:        'JetBrains Mono', 'SF Mono', monospace
--font-sans:        'Inter', -apple-system, sans-serif
```

### Typography Scale

Stop using text-[9px] and text-[10px]. Minimum readable size is 11px.

```
--text-xs:    11px    /* smallest allowed — table cells, timestamps */
--text-sm:    12px    /* secondary labels, card subtitles */
--text-base:  13px    /* body text, table data */
--text-lg:    15px    /* card titles */
--text-xl:    18px    /* section headers */
--text-2xl:   24px    /* KPI numbers */
--text-3xl:   32px    /* hero stat (e.g. flow gauge number) */
```

### Spacing

Use consistent 4px grid. Panels use `p-4` (16px) internal padding. Gap between panels: `gap-4` (16px).
No `gap-2` or `gap-3` mixing.

---

## What to Remove

These are the AI-generated tells. Remove all of them:

1. **All `animate-pulse` on data elements.** Only allowed on the AIS connection status dot.
2. **All `backdrop-blur` and transparency** (`bg-slate-900/50`, `bg-amber-950/40`, etc). Use solid colors from the token palette above.
3. **All "Info" explanation boxes** at the bottom of panels (the ones with the `<Info>` icon explaining what floating storage is, what EFS means, etc). The user knows. Delete them entirely.
4. **All `tracking-widest` and `tracking-wider`** on uppercase labels. Use `tracking-wide` maximum.
5. **All colored status pills/badges** inside panels (the `bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20` pattern). Replace with plain text or a single teal/gold/red dot.
6. **All loading skeleton shimmer animations** (the `h-6 bg-slate-800/50 rounded animate-pulse` pattern). Replace with a single centered "Loading..." in `--text-secondary` color. Simple.
7. **Excessive rounded corners.** Cards use `rounded-lg` (8px) maximum. No `rounded-xl` or `rounded-2xl`. Inner elements use `rounded` (4px) or `rounded-md` (6px).
8. **Rainbow color coding.** KPI cards currently use blue/amber/emerald/slate/cyan/violet — six different colors for six cards. Replace: all KPI cards use the same `--bg-card` background with `--border` border. The number itself is `--text-primary`. Only use accent colors for meaning (teal = normal, gold = warning, red = critical).

---

## Component-Level Specs

### Header (`Dashboard.tsx` header)

Current: rounded ship icon in amber box, 10px uppercase labels, pill-shaped status indicator.

New:
- Left: text logo only. "HUMMUS TRACKER" in `--text-primary`, `text-lg`, `font-semibold`, `tracking-wide`. Subtitle "Strait of Hormuz Intelligence" in `--text-tertiary`, `text-sm`. No icon box.
- Right: Brent and WTI prices as plain numbers. Format: "BRENT $109.03" in `text-sm font-mono`. Label in `--text-secondary`, price in `--accent-teal`. Separator: a `1px` vertical line in `--border`.
- Far right: connection status. Small circle (6px) — teal if live, gold if mock, red if disconnected. Text label next to it in `text-xs --text-secondary`. No pill/badge shape.
- Header background: `--bg-primary` with bottom border `--border`. No blur, no transparency.
- Sticky top, `z-50`.

### KPI Row

Current: 6 cards with different icon colors, rounded-lg borders in matching colors.

New:
- Same 6 KPIs, single row.
- All cards: `--bg-card` background, `--border` border, `rounded-lg`.
- Label: `text-xs`, `--text-secondary`, uppercase, `tracking-wide`. No icon next to label.
- Value: `text-2xl`, `font-mono`, `font-bold`, `--text-primary`.
- Suffix (e.g. "mbpd"): `text-xs`, `--text-tertiary`, inline after the number.
- No icons inside the cards. The label is sufficient. Icons add noise when you have 6+ cards in a row.

### Panel Container (reusable `Panel` component)

Current: `bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden` with header divider.

New:
- Container: `bg-[--bg-card] border border-[--border] rounded-lg overflow-hidden`
- Header: `px-4 py-3 border-b border-[--border]`
  - Title: `text-lg font-semibold --text-primary`
  - Subtitle: `text-sm --text-secondary` — one line, no wrapping
- Body: `p-4`
- No shadows. No glow effects.

### Vessel Map (`VesselMap.tsx`)

- Keep Leaflet map as-is for tile rendering.
- Map container: full height of its grid cell, `rounded-lg overflow-hidden`, `border border-[--border]`.
- Use dark map tiles (already likely using CartoDB dark or similar).
- Vessel markers: simple circles, `--accent-teal` fill for normal tankers, `--accent-gold` for loaded outbound, `--text-tertiary` for ballast.

### Vessel Table (`VesselTable.tsx`)

This should look like a Bloomberg terminal table:
- Header row: `--bg-primary` background, `text-xs`, uppercase, `--text-secondary`, `tracking-wide`. Sticky top within the panel scroll area.
- Data rows: `text-sm font-mono --text-primary`. Alternating row colors: odd rows `--bg-card`, even rows `--bg-primary`.
- Hover: `--bg-card-hover`.
- Loaded status: don't use a colored badge. Just the word "LOADED" in `--accent-teal` or "BALLAST" in `--text-tertiary`.
- Direction: "OUT" in `--accent-teal`, "IN" in `--text-secondary`. No arrows, no icons.
- Borders: only horizontal lines between rows (`border-b border-[--border]`). No vertical cell borders.

### Charts (PriceChart, TransitChart, MarketMetricsPanel, FujairahInventoryPanel)

- Use the brand palette for data series:
  - Primary line: `--accent-teal` (#00a19c)
  - Secondary line: `--accent-gold` (#c4a35a)
  - Tertiary line: `--text-secondary` (#8b9bb4)
  - Bar fills: `--accent-teal-dim` (#007a76) at 60% opacity
- Grid lines: `--border` (#1c2e4a)
- Axis labels: `text-xs font-mono --text-tertiary`
- Tooltip: `--bg-card` background, `--border` border, `text-xs`. No rounded-xl, use `rounded`.
- Legend: `text-xs --text-secondary`. Positioned top-right inside the chart area, not below.

### Intelligence Panels (DarkVesselPanel, STSEventsPanel, FloatingStoragePanel)

Current: each has colored header boxes, status pills, icon grids, and an "Info" explainer.

New:
- **Delete the Info explainer box** at the bottom of each panel.
- **Delete the colored count header box** (the `bg-red-950/20 border border-red-900/30` pattern). Replace with the count as a plain number in the panel header subtitle: e.g. title "Dark Vessels", subtitle "2 active".
- Event/vessel list items:
  - Simple rows with `border-b border-[--border]` separator.
  - Vessel name: `text-sm font-semibold --text-primary`
  - Metadata (position, time, speed): `text-xs font-mono --text-secondary`
  - No colored left-borders (`border-l-2 border-l-red-500/50` — remove).
  - Critical indicator: small 6px dot in `--accent-red` (dark vessels) or `--accent-gold` (STS) before the vessel name. That's it.
- Empty state: "No events" in `--text-tertiary`, centered, `text-sm`. No dashed borders, no italic.

### OPEC Compliance Table (`OPECCompliancePanel.tsx`)

- Follow the vessel table style (Bloomberg terminal aesthetic).
- Header: uppercase, `text-xs`, `--text-secondary`.
- Data: `font-mono text-sm`.
- Delta column: positive values in `--accent-red`, negative in `--accent-green`, zero in `--text-tertiary`. No icons (remove CheckCircle2 and AlertCircle).
- Exempt: plain text "EXEMPT" in `--text-tertiary`. No colored dot.

### Port Congestion (`PortCongestionPanel.tsx`)

- Horizontal bar chart: bars in `--accent-teal`. Bars exceeding 36h threshold in `--accent-gold`. Bars exceeding 48h in `--accent-red`.
- Remove the duplicate list below the chart (currently shows the same data as cards). The chart is enough.
- **Delete the Info explainer box.**

### Fujairah Inventory (`FujairahInventoryPanel.tsx`)

- Stacked bar chart: light = `--accent-teal`, middle = `--accent-gold`, heavy = `--text-secondary`.
- Summary cards above chart: same style as KPI cards (solid `--bg-card`, `font-mono` numbers).
- **Delete the Info explainer box.**

### Market Metrics / EFS (`MarketMetricsPanel.tsx`)

- EFS spread and M1-M6 spread: display as large `font-mono text-2xl` numbers in their own line, not inside colored boxes.
- Structure label ("Backwardation" / "Contango"): plain text in `--accent-teal` or `--accent-gold` respectively. `text-xs uppercase`.
- Forward curve chart: Brent line in `--accent-teal`, Dubai line in `--accent-gold`. Dot markers kept.
- **Delete the Info explainer box.**

### Freight Rates (`FreightRates.tsx`)

- Table format matching the Bloomberg terminal style (same as vessel table).
- WS points and TCE rate: `font-mono --text-primary`.
- Status column: "RISING" in `--accent-gold`, "STABLE" in `--text-secondary`. Plain text, no badges.

---

## Layout Grid

Keep the current Sprint 2 layout structure from `ENHANCEMENTS.md` (S2-6 describes tabs), but
until tabs are implemented, the single-page layout should be:

```
[Header — sticky]
[KPI Row — 6 cards]
[Map (2/3) | Sidebar (1/3): Supply Chain, Volume by Flag, Freight]
[Intelligence Row — 3 equal columns: Dark Vessels, STS Alerts, Floating Storage]
[Market Row — 4 equal columns: EFS Spread, Fujairah, OPEC Compliance, Terminal Wait Times]
[Vessel Table — full width]
[Charts Row — 2 columns: Price-Flow Correlation, IMF Transit Counts]
[Disruption Timeline — full width]
[Footer]
```

This is the current layout in Dashboard.tsx. Do not change the grid structure. Only restyle.

---

## Tailwind Config Changes

Update `tailwind.config.js` to add the brand tokens as custom colors:

```js
theme: {
  extend: {
    colors: {
      petro: {
        bg: '#0a1628',
        card: '#0f1d32',
        'card-hover': '#142540',
        border: '#1c2e4a',
        'border-accent': '#2a4060',
        teal: '#00a19c',
        'teal-dim': '#007a76',
        gold: '#c4a35a',
        red: '#c4463a',
        green: '#2d8a6e',
      },
      text: {
        warm: '#e8e4df',
        muted: '#8b9bb4',
        faint: '#566b8a',
      }
    },
    fontFamily: {
      mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      sans: ['Inter', '-apple-system', 'sans-serif'],
    }
  }
}
```

Then use `bg-petro-bg`, `text-text-warm`, `border-petro-border`, `text-petro-teal` etc throughout.

---

## Font Loading

Add to `index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## Implementation Complete

- [x] Update `tailwind.config.js` with brand tokens
- [x] Add font imports to `index.html`
- [x] Update `index.css` — set body background to `--bg-primary`, default text to `--text-primary`
- [x] Restyle `Dashboard.tsx` — header, KPI cards, Panel component
- [x] Restyle `VesselTable.tsx` — Bloomberg terminal table
- [x] Restyle `VesselMap.tsx` — clean border, marker colors
- [x] Restyle `PriceChart.tsx` — brand palette for lines/bars
- [x] Restyle `TransitChart.tsx` — brand palette
- [x] Restyle `MarketMetricsPanel.tsx` — remove info box, use brand colors
- [x] Restyle `FloatingStoragePanel.tsx` — remove info box, simplify
- [x] Restyle `DarkVesselPanel.tsx` — remove info box, simplify
- [x] Restyle `STSEventsPanel.tsx` — remove info box, simplify
- [x] Restyle `FujairahInventoryPanel.tsx` — remove info box, brand chart colors
- [x] Restyle `OPECCompliancePanel.tsx` — remove icons, Bloomberg table style
- [x] Restyle `PortCongestionPanel.tsx` — remove info box, remove duplicate list
- [x] Restyle `FreightRates.tsx` — Bloomberg table style
- [x] Restyle `SupplyChainImpact.tsx` — brand colors
- [x] Restyle `VolumeByFlag.tsx` — brand colors
- [x] Restyle `ExporterBreakdown.tsx` — brand colors
- [x] Restyle `DisruptionTimeline.tsx` — brand colors, simplify
- [x] Restyle `FlowMeter.tsx` — brand colors
- [x] Verify no text smaller than 11px remains
- [x] Verify no animate-pulse except connection status dot
- [x] Verify no backdrop-blur or transparency patterns remain
- [x] Verify no Info explainer boxes remain

### Feedback for Claude:
- The Bloomberg aesthetic works exceptionally well for this data set. Switching to 11px font-mono for table data significantly increased density without sacrificing legibility.
- Removal of icons from KPI cards and side-panels removed substantial visual noise, making the numbers themselves the primary signal.
- The "Petro-teal" (#00a19c) and "Petro-gold" (#c4a35a) contrast provides a clear, professional distinction between normal operations and high-value/warning states.
- Implementation note: I kept the `animate-pulse` on the connection dot and the "Signal Lost" map tooltips as these are active warnings, but removed it from all other data loading states as requested.
