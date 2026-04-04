# User Acceptance Testing (UAT) Report — Hummus Tracker
**Date:** April 5, 2026
**Target:** https://hummus-trackerz.fly.dev | https://oil.yieldwise.my

---

## 1. Executive Summary

### Live UAT Results (against deployed code, pre-Phase 4 deploy)
**5 PASS / 10 WARN / 12 FAIL**

### Expected After Phase 4 Deploy
**10+ PASS / 10 WARN / 5-7 FAIL** (startup triggers populate 5+ empty endpoints)

### Critical Discovery
The live deployment runs in **LIVE AIS mode** (not mock) — aisstream.io is connected with a real API key. However, AIS coverage is extremely sparse: only **2 vessels** tracked (both non-tankers) vs the expected 50-80 daily transits. This sparsity is the root cause of most downstream failures (empty flow, 0% OPEC compliance, no dark/STS/storage detections).

---

## 2. Live Endpoint Test Results

### A. Core Infrastructure

| Endpoint | Status | Finding |
|:---|:---|:---|
| `/api/health` | PASS | `{"status":"ok"}` |
| `/api/overview` | WARN | `vessels_tracked: 0`, `tankers_active: 0` despite `ais_stream.active_vessels: 2`. Both vessels are non-tankers (type 0). `brent: 121.88` from FRED (5d stale) |
| `/api/status` | WARN | Score 58 = RED. "Flow at 0% of baseline" — accurate given 0 tankers but alarming without context |

### B. Vessel Intelligence

| Endpoint | Status | Finding |
|:---|:---|:---|
| `/api/vessels/live` | FAIL | 2 vessels, both non-tankers (`vessel_type: 0`). **Impossible speeds: 46.8kt and 48.5kt** (commercial max ~16-25kt). One vessel "moored" yet showing 48.5kt. `mode: "live"` |
| `/api/vessels/dark` | WARN | Empty `[]`. No tankers tracked = no dark detection possible |
| `/api/vessels/sts` | WARN | Empty `[]`. No tankers = no STS pairs |
| `/api/vessels/floating-storage` | FAIL | Empty, `summary: null`. Null summary is a code-level bug |

### C. Activity & Briefs

| Endpoint | Status | Finding |
|:---|:---|:---|
| `/api/activity?limit=10` | WARN | 1 event only: "CRITICAL: Strait flow at 0% of baseline". Startup triggers haven't fired (old deploy) |
| `/api/brief/latest` | FAIL | Returns `null` with HTTP 200. Startup trigger not deployed yet |

### D. Flow & Analytics

| Endpoint | Status | Finding |
|:---|:---|:---|
| `/api/flow/estimate` | WARN | `estimated_mbpd: 0.0`, `deviation_pct: null`. Zero tankers = zero flow |
| `/api/flow/daily?days=30` | FAIL | 1 record returned for 30 requested. No backfill deployed yet |
| `/api/flow/baseline` | PASS | Static EIA reference. 20.0 mbpd, exporter breakdown accurate |
| `/api/flow/imf?days=30` | WARN | 30 records to Mar 29 (6d lag, normal for IMF). Feb 28 spike still present (76 transits vs avg 7) — outlier filter not deployed |
| `/api/flow/freight` | WARN | `market_sentiment: "NEUTRAL"` contradicts RED status. Sentiment-health link not deployed yet |
| `/api/flow/opec-compliance` | FAIL | All countries at 0.0 mbpd observed / 0% compliance. Misleading without warning. Sparse-data guard not deployed |
| `/api/flow/impact` | WARN | Impact model credible ($252M/day, $480K/VLCC cape). `selective_transits: []` empty |
| `/api/flow/insurance` | PASS | JWLA-033, 100 BPS, 6.67x multiplier. Math correct |

### E. Pricing

| Endpoint | Status | Finding |
|:---|:---|:---|
| `/api/prices/oil?days=30` | WARN | 18 records (FRED trading days only). Latest Mar 30, 5d stale. Brent $121.88 |
| `/api/prices/market-metrics` | WARN | Brent M1 $109.03 (yfinance). **$12.85 gap vs FRED** — dual-price fix not deployed |
| `/api/prices/efs-history?days=30` | FAIL | Empty `[]`. Market data backfill not deployed |
| `/api/prices/bunkers/latest` | PASS | VLSFO $853.76, HSFO $758.44, Hi-5 $95.32. Current date |
| `/api/prices/bunkers/history?days=30` | PASS | 30 records, uptrend consistent with Brent |

### F. Regional Data

| Endpoint | Status | Finding |
|:---|:---|:---|
| `/api/fujairah/latest` | WARN | Apr 1 (3d lag, normal weekly). No units field |
| `/api/fujairah/history?limit=12` | PASS | 12 weekly records, clean variance |
| `/api/congestion/latest` | FAIL | Empty `[]`. Startup trigger not deployed |
| `/api/weather/latest` | FAIL | Empty `[]`. Startup trigger not deployed |
| `/api/disruptions/` | WARN | 6 events (3 from 2019, 3 recent). No event explains the 0% flow condition |

---

## 3. Issues Resolved in Phase 4 (Ready to Deploy)

| Fix | Impact | Files |
|:---|:---|:---|
| **Dual Brent pricing** | Header shows BZ=F (ICE Futures M1) alongside DCOILBRENTEU (FRED Spot). Resolves $12.85 contradiction | `fred.py`, `client.ts`, `Dashboard.tsx` |
| **LIMITED AIS banner** | Gold banner when live mode has <5 tankers: "LIMITED AIS COVERAGE — X tankers tracked vs ~50 expected" | `Dashboard.tsx` |
| **OPEC sparse-data guard** | Gold warning "Insufficient AIS coverage" when <5 tankers in live mode (not just mock mode) | `OPECCompliancePanel.tsx` |
| **Speed cap** | AIS speeds >30kt capped to 0 (data quality filter for impossible readings like 46-48kt) | `ais_stream.py` |
| **Congestion vessel speed** | Mock congestion vessels now emit `speed_kt: 0.8-1.5` instead of 11-14kt. Fixes congestion detection | `ais_stream.py` |
| **Startup triggers** | Weather, congestion, brief, EFS backfill, transit backfill, dark/STS detection all fire on boot | `main.py` |
| **UIUX compliance** | 13 instances of sub-11px text fixed, tracking-wider/widest → tracking-wide | Multiple |

---

## 4. Remaining Issues After Deploy

### Will NOT be fixed by deploy (data source / infrastructure)

| ID | Issue | Root Cause | Mitigation |
|:---|:---|:---|:---|
| R-1 | **AIS feed sparsity** — 2 vessels (0 tankers) vs 50+ expected | aisstream.io coverage gap or API key tier limitation for Hormuz bbox | LIMITED AIS COVERAGE banner warns users. Consider upgrading AIS API tier or adding MarineTraffic/VesselFinder as fallback |
| R-2 | **OPEC compliance misleading** | 0 tankers observed = 0% compliance for all countries | Gold "Insufficient AIS coverage" badge. Backend could suppress compliance endpoint entirely when tanker_count < 10 |
| R-3 | **Floating storage summary: null** | `get_storage_summary()` returns None when no FloatingStorageSummary record exists | Should return zeroed object instead of null |
| R-4 | **Flow estimate shows 0.0 mbpd** | No tankers = no barrels observed | Accurate but concerning. Could fall back to IMF PortWatch estimate |
| R-5 | **FRED prices 5+ days stale** | FRED publication schedule + possible scheduler not firing reliably on Fly | Staleness indicator (gold date) already implemented. Could add yfinance fallback for recent days |

### Deployment tasks for Gemini

| Task | Priority | Description |
|:---|:---|:---|
| **Fix floating storage null** | P0 | `backend/services/storage.py:get_storage_summary()` — return `{"date": today, "vessel_count": 0, "total_barrels": 0}` instead of `None` |
| **Investigate AIS API key** | P0 | Check aisstream.io dashboard for rate limits, quota, or bbox coverage issues. The Hormuz bbox (24.5-27.0°N, 55.5-58.0°E) should see heavy traffic. If key is free tier, consider upgrading |
| **Suppress OPEC when insufficient data** | P1 | Backend: return `{"status": "insufficient_data", "min_tankers_required": 10}` when tanker observations < 10 in 7-day window |
| **IMF-based flow fallback** | P1 | When live AIS tanker count is 0, use IMF PortWatch tanker_transits to derive estimated_mbpd instead of showing 0.0 |

---

## 5. What Works Well

| Feature | Assessment |
|:---|:---|
| EIA baseline data | Accurate, well-sourced |
| Insurance/JWC status | JWLA-033 credible, math correct |
| Bypass/impact analysis | Cape reroute costs within industry estimates |
| Bunker price series | Complete 30-day history, trend-coherent |
| Freight rate modeling | Internally consistent WS/TCE |
| Fujairah inventory | 12-week history with proper variance |
| Dashboard UIUX | Bloomberg-style density, responsive, spec-compliant |
| Dual Brent prices | FRED Spot + ICE Futures clearly labeled (after deploy) |
| LIMITED AIS banner | Transparent about coverage gaps (after deploy) |
| Cold boot fallback | Cached daily summaries on machine resume |

---

## 6. Fix History

### Phase 1 — UAT Cycle 1 (Gemini)
Weather API fix, STS MaxDraught, timezone normalization, overview dark/STS counts

### Phase 2 — Consolidation (Claude)
SIMULATED banner, OPEC mock warning, startup triggers, congestion dead code, empty panel states, TS types

### Phase 3 — Mock Scenarios (Gemini, validated by Claude)
Mock stream vessels (storage/congestion/dark/STS), Fujairah variance, freight sentiment, IMF outlier filter, era badges, source footers, price staleness, SQLite WAL, UIUX fixes (13 instances)

### Phase 4 — Live UAT (Claude)
- Dual Brent pricing (FRED spot + ICE futures in header)
- LIMITED AIS COVERAGE banner (gold, when <5 tankers in live mode)
- OPEC sparse-data guard (works in live AND mock mode)
- AIS speed cap (>30kt → 0, filters impossible readings)
- Congestion vessel speed fix (mock vessels now emit <2kt)
- TS build error fix (PriceChart nullable date)

---

## 7. Go-Live Verdict

**CONDITIONAL PASS** — Deploy Phase 4 changes, then:
- If AIS feed populates (>10 tankers): **READY** for demo/internal use
- If AIS feed stays sparse (<5 tankers): **READY with caveats** — gold banner warns users, static reference data (baseline, insurance, freight, bunkers, Fujairah) remains valuable. Vessel-derived analytics will be incomplete.
- **NOT ready** for live trading decisions until AIS coverage is resolved
