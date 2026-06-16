# Hummus Tracker — Strait of Hormuz Strategic Intelligence Dashboard

A high-fidelity maritime intelligence dashboard focused on the **Strait of Hormuz** (~20.9 mbpd oil, ~20% global LNG). Hourly static-snapshot architecture; scale-to-zero on Fly.io; live at **https://oil.yieldwise.my**.

---

## Architecture

The dashboard uses a **snapshot + static-serve** model — no always-on AIS websocket, no live external calls at request time.

```
GitHub Actions cron (hourly)
        │
        ▼
backend/snapshot.py  ──► snapshots/*.json  (39 endpoint files)
                                │
                        backend/serve.py  ◄── React SPA (Vite)
                                │
                        Fly.io (sin region, scale-to-zero,
                                persistent volume for SQLite + snapshots)
```

- **`backend/snapshot.py`** — Runs the full pipeline once per hour: seeds the DB, samples the AIS stream for a bounded window (`AIS_SAMPLE_SECONDS`, default 75 s), runs all aggregation/detection/alert jobs, calls every frontend API endpoint in-process via ASGI, and dumps JSON to `snapshots/*.json`. This is the source of truth for what endpoints exist (`ENDPOINTS` list).
- **`backend/serve.py`** — Lightweight static server. Serves `snapshots/*.json` for `/api/…` requests (query strings ignored) and the compiled SPA. No live external calls.
- **`backend/main.py`** — Full FastAPI app defining endpoint shapes; imported by `snapshot.py` for in-process ASGI calls. Not the serving entrypoint.
- **Frontend** — React / TypeScript / Vite. Self-hosted fonts and Leaflet CSS (no CDN). Code-split lazy tabs, vessel map with heading arrows and rich click popups. `DataFreshnessBadge` shows last snapshot time. Global `ErrorBoundary`. Mobile-responsive (390 px verified).

**Deploy**: Fly.io app `hummus-tracker`, region `sin`, `min_machines_running = 0`, `auto_stop_machines = "stop"` (true scale-to-zero, ~$0 idle). Persistent volume keeps SQLite DB + `snapshots/` across machine cycles. Refresh is driven by an external GitHub Actions cron — the machine does not need to stay up between runs.

---

## Feature Overview

### Vessels / Map (Tab 1)
| Panel | Notes |
|---|---|
| Live vessel map | Leaflet map with heading arrows, shipping lane corridors (inbound/outbound), risk markers. AIS positions are **SIM** (simulated; clearly badged). |
| Vessel list (`/api/vessels/live`) | Vessel name, flag, type, draught, speed, heading — all simulated. |
| Dark vessels (`/api/vessels/dark`) | Vessels with AIS transponder off — SIM. |
| STS transfers (`/api/vessels/sts`) | Ship-to-ship transfer events — SIM. |
| Floating storage (`/api/vessels/floating-storage`) | Anchored tankers used as storage — SIM. |
| GPS / AIS integrity banner (`/api/integrity`) | Spoofing/jamming alerts derived from Google News — LIVE. |

### Oil & LNG Markets (Tab 2)
| Panel | Notes |
|---|---|
| Brent / oil prices (`/api/prices/oil`) | Brent spot series via EIA — LIVE. |
| Market metrics (`/api/prices/market-metrics`) | Brent contango/backwardation, WTI spread — LIVE. |
| OVX volatility (`/api/volatility`) | CBOE OVX (oil VIX) via FRED — LIVE. |
| Gas prices (`/api/gas-prices`) | Henry Hub, EU TTF, JKM LNG — LIVE via FRED. |
| EFS history (`/api/prices/efs-history`) | Exchange-for-swaps history — EST. |
| Bunker prices (`/api/prices/bunkers/latest`, `/history`) | VLSFO/MGO — EST (seeded). |
| Freight charges (`/api/flow/freight`) | Worldscale, TCE day rates — EST (heuristic). |
| OPEC/Gulf production (`/api/production`) | Saudi, Iran, UAE, Iraq, Kuwait + OPEC total (mbpd) via EIA — LIVE. |

### Flow & Chokepoints (Tab 2 / cross-tab)
| Panel | Notes |
|---|---|
| Strait flow estimate (`/api/flow/estimate`, `/baseline`, `/impact`) | EIA-derived mbpd baseline; flow deviation triggers alerts. |
| OPEC compliance (`/api/flow/opec-compliance`) | Compliance delta vs quota — EST. |
| IMF PortWatch multi-chokepoint (`/api/chokepoints`, `/api/flow/imf`) | Transit counts and deviation for Hormuz, Suez, Malacca, Bab-el-Mandeb, Panama, Bosphorus — LIVE. |
| Bypass supply-gap (`/api/bypass`) | TAPS + Saudi East–West pipeline bypass capacity vs Hormuz throughput — EST (IEA/EIA parameters). |
| "What-If Hormuz Closes" scenario calculator | Client-side sliders: % closure, Brent range, stock-buffer days. Outputs supply removed, price range, buffer days. |
| Daily flow series (`/api/flow/daily`) | Historical flow mbpd — EST. |

### Risk & Geopolitical (Tab 3)
| Panel | Notes |
|---|---|
| Risk Index v2 (`/api/risk-index`) | 8-component composite score (0–100). Aggregation: `0.65 × weighted-mean + 0.35 × worst-component`. 7 LIVE components + 1 EST. Components: Hormuz flow deviation, OVX, news velocity, weather severity, seismic activity, GPR index, incident rate, freight/insurance signal. Each component tier-tagged. |
| Risk decomposition | Component-level contribution = score × weight; shown as horizontal bar chart. |
| GPR index (`/api/gpr`) | Caldara-Iacoviello Geopolitical Risk Index (monthly) — LIVE. |
| Incident timeline (`/api/incidents`) | Maritime kinetic incidents (attacks, seizures, drone strikes) sourced from Google News, classified by type and severity — LIVE (Google News). |
| News wire (`/api/news`) | Recent Hormuz-related headlines — LIVE (Google News). |
| Congestion (`/api/congestion/latest`) | Anchorage / waiting-vessel congestion — EST. |
| Fujairah stocks (`/api/fujairah/latest`, `/history`) | Fujairah oil inventory — EST (seeded). |
| Insurance multipliers (`/api/flow/insurance`) | War risk insurance rate multipliers — EST (seeded). |

### Situational / Environmental (Tab 3)
| Panel | Notes |
|---|---|
| Weather / marine (`/api/weather/latest`, `/api/marine`) | Shamal wind, wave height, swell, ocean current via Open-Meteo Marine — LIVE. |
| Seismic (`/api/seismic`) | Gulf-region earthquakes M ≥ 4.0 via USGS FDSN — LIVE. |

### Credibility System
- **LIVE / EST / SIM** tier badges on every panel.
- Methodology modal: full source list, derived-signal explanations, 8-component index weights.
- `DataFreshnessBadge` shows snapshot timestamp on every page.
- Qatar LNG disruption banner derived from IMF PortWatch Hormuz chokepoint deviation.

---

## Data Sources

| Source | What it provides | Tier | Endpoint(s) |
|---|---|---|---|
| FRED (St. Louis Fed) | OVX oil-volatility index; Henry Hub, EU TTF, JKM LNG gas prices; Brent | LIVE | `https://api.stlouisfed.org/fred/series/observations` |
| EIA (U.S. Energy Info. Admin.) | Brent spot price series; OPEC/Gulf country production (mbpd) | LIVE | `https://api.eia.gov/v2` |
| IMF PortWatch | Satellite AIS transit counts + capacity for 6 chokepoints | LIVE | `portwatch.imf.org` |
| Open-Meteo (forecast) | Shamal wind speed/direction, Gulf weather | LIVE | `https://api.open-meteo.com/v1/forecast` |
| Open-Meteo (marine) | Wave height, swell period, ocean current | LIVE | `https://marine-api.open-meteo.com/v1/marine` |
| USGS FDSN | Gulf-region earthquakes M ≥ 4.0 | LIVE | `https://earthquake.usgs.gov/fdsnws/event/1/query` |
| Google News | Maritime incident headlines; GPS/AIS integrity alerts | LIVE | RSS/scrape |
| Caldara-Iacoviello GPR | Monthly Geopolitical Risk Index | LIVE | `https://www.matteoiacoviello.com/gpr_files/data_gpr_export.xls` |
| AIS Stream | Real vessel positions (sampled 75 s/hr via websocket) | **SIM** | API key required; returns empty → mock vessels shown |
| War-risk insurance rates | Multipliers for VLCC/Suezmax/Aframax | **EST** | Seeded/heuristic |
| Bunker prices (VLSFO/MGO) | Fujairah bunker market | **EST** | Seeded |
| Fujairah oil inventory | Weekly Fujairah tank inventory | **EST** | Seeded |
| Bypass capacity | TAPS + Saudi E–W pipeline gap vs Hormuz | **EST** | IEA/EIA parameters |
| Freight/TCE | Worldscale, time-charter day rates | **EST** | Heuristic model |

### Deferred / Requires Registration
| Source | Reason deferred |
|---|---|
| GIE AGSI+ (EU gas storage) | Requires registered API key |
| MARAD maritime advisories | WAF-403 / not machine-readable |
| UKMTO incident reports | PDF-only feed |
| Real Gulf AIS (MarineTraffic, Spire) | Paid plans only |

---

## Endpoints (39 total)

All served from `snapshots/*.json` — generated by `backend/snapshot.py`:

```
/api/overview              /api/status               /api/activity
/api/brief/latest          /api/flow/freight         /api/flow/opec-compliance
/api/flow/impact           /api/flow/estimate        /api/flow/baseline
/api/flow/insurance        /api/flow/daily           /api/flow/imf
/api/vessels/live          /api/vessels/dark         /api/vessels/sts
/api/vessels/floating-storage
/api/prices/oil            /api/prices/market-metrics
/api/prices/efs-history    /api/prices/bunkers/latest
/api/prices/bunkers/history
/api/fujairah/latest       /api/fujairah/history
/api/congestion/latest     /api/weather/latest       /api/disruptions/
/api/risk-index            /api/history/series       /api/news
/api/gas-prices            /api/volatility           /api/chokepoints
/api/bypass                /api/seismic              /api/marine
/api/gpr                   /api/production           /api/integrity
/api/incidents
```

---

## Run / Dev

### Prerequisites
- Python 3.10+, Node.js 18+
- API keys (see `.env.example`): `FRED_API_KEY`, `EIA_API_KEY`, `AISSTREAM_API_KEY`

### Development
```bash
# Install deps
pip install -r requirements.txt
npm install

# Generate snapshot (seeds DB, samples AIS 75s, writes snapshots/*.json)
python -m backend.snapshot

# Serve static API + SPA (no live external calls)
PYTHONPATH=. uvicorn backend.serve:app --port 8888

# Frontend dev server (proxies /api to :8888)
npm run dev

# Tests (pytest smoke tests for all services)
pytest

# Frontend build
npm run build

# Playwright QA
cd frontend/qa && npx playwright test
```

### Deploy (Fly.io)
App: `hummus-tracker` | Region: `sin` | Live: **https://oil.yieldwise.my**

```bash
fly deploy
```

`entrypoint.sh` starts `uvicorn backend.serve:app`. Scale-to-zero (`min_machines_running = 0`); hourly refresh driven by GitHub Actions cron (not the serving process). Persistent volume mounts SQLite DB + `snapshots/`.

---

*Marathon build log: [docs/research/marathon-log.md](./docs/research/marathon-log.md)*
*Research findings digest: [docs/research/findings-digest.md](./docs/research/findings-digest.md)*
