# Hormuz Tracker — Research Findings Digest

Captured from the 6-hour research-and-enhance marathon (2026-06-15/16). This digest preserves the sourced insights that drove design decisions so they are not lost in the build log.

---

## 1. Hard Facts: Strait of Hormuz

| Metric | Value | Source |
|---|---|---|
| Oil throughput | ~20.9 mbpd (~21% of global petroleum liquids) | EIA Hormuz fact sheet |
| LNG throughput | ~20% of global LNG trade (~4 bcf/day), predominantly Qatar exports | IEA / EIA |
| Qatar LNG share | Qatar is the world's second-largest LNG exporter; nearly all exports transit Hormuz | IEA World Energy Outlook |
| Strait width | ~33 km navigable; 3.2 km inbound + 3.2 km outbound shipping lanes | US EIA / NAVCEN |
| Bypass capacity | ~8.5–9.8 mbpd (Saudi East–West pipeline ~5 mbpd + TAPS); covers ~28% of typical Hormuz flow | IEA/EIA |
| Stock buffer | IEA Strategic Petroleum Reserve drawdown capacity ~30 days at full disruption | IEA |
| Countries dependent | UAE, Kuwait, Iraq, Bahrain: effectively 100% of seaborne oil exports via Hormuz | EIA |

**Key implication:** A complete Hormuz closure removes ~11–12 mbpd net of bypass; no bypass route exists for LNG.

---

## 2. Multi-Chokepoint Context

The marathon incorporated IMF PortWatch data covering **six global chokepoints**, enabling cross-chokepoint analysis:

| Chokepoint | Typical daily vessels | Strategic role |
|---|---|---|
| Strait of Hormuz | ~80–100 tankers/day | Persian Gulf oil + Qatar LNG |
| Suez Canal | ~50 ships/day | Europe–Asia shortcut |
| Malacca Strait | ~80 ships/day | Asia energy supply |
| Bab-el-Mandeb | ~50 ships/day | Red Sea / Europe access |
| Panama Canal | ~35 ships/day | US East–West trade |
| Bosphorus | ~120 ships/day | Black Sea oil egress |

IMF PortWatch (`portwatch.imf.org`) provides satellite-AIS transit counts and capacity deviation time series at no cost. It is one of the highest-quality free signals available and directly feeds the `/api/chokepoints` and `/api/flow/imf` endpoints.

---

## 3. Free Data Source Catalog

All sources actively used in production:

| Source | Data provided | Endpoint URL | Key required? |
|---|---|---|---|
| **FRED** (St. Louis Fed) | OVX (oil volatility, `OVXCLS`); Henry Hub (`DHHNGSP`); EU TTF gas; JKM LNG; Brent spot | `https://api.stlouisfed.org/fred/series/observations` | Yes — free registration |
| **EIA** (U.S. Energy Info. Admin.) | Brent crude spot price; OPEC/Gulf production (Saudi ~12.6, Iran ~4.7, OPEC ~35.4 mbpd) | `https://api.eia.gov/v2` | Yes — free registration |
| **IMF PortWatch** | Satellite AIS transit counts + capacity deviation for 6 chokepoints | `https://portwatch.imf.org/` | No |
| **Open-Meteo (forecast)** | Shamal wind speed/direction, Gulf weather | `https://api.open-meteo.com/v1/forecast` | No |
| **Open-Meteo (marine)** | Wave height, swell period, ocean current | `https://marine-api.open-meteo.com/v1/marine` | No |
| **USGS FDSN** | Earthquakes M ≥ 4.0 in Gulf bounding box (lat 22–32, lon 48–62) | `https://earthquake.usgs.gov/fdsnws/event/1/query` | No |
| **Google News RSS** | Maritime incident headlines; GPS/AIS spoofing alerts | RSS/scrape | No (rate-limited) |
| **Caldara-Iacoviello GPR** | Monthly Geopolitical Risk Index — newspaper mention counts | `https://www.matteoiacoviello.com/gpr_files/data_gpr_export.xls` | No |
| **AISStream** | Real vessel AIS positions (websocket, 75 s sample/run) | `wss://stream.aisstream.io/v0/stream` | Yes — free tier; Gulf sparse → mock vessels shown |

### Deferred Sources (not free or not accessible)
| Source | Reason |
|---|---|
| **GIE AGSI+** (EU gas storage) | Requires registered API key |
| **MARAD maritime advisories** | Returns WAF-403 / not machine-readable |
| **UKMTO incident reports** | PDF-only feed |
| **MarineTraffic / Spire** | Paid real-time AIS |

---

## 4. Risk Index v2 — Methodology Rationale

### Components (8 total, post-marathon)
| # | Component | Tier | Signal source |
|---|---|---|---|
| 1 | Hormuz flow deviation | LIVE | IMF PortWatch vs EIA baseline |
| 2 | OVX oil volatility | LIVE | FRED `OVXCLS` |
| 3 | News velocity | LIVE | Google News incident rate |
| 4 | Weather severity | LIVE | Open-Meteo (Shamal wind ≥ 25 kn, wave ≥ 2 m) |
| 5 | Seismic activity | LIVE | USGS FDSN (M ≥ 4.5 events in 7 days) |
| 6 | GPR index | LIVE | Caldara-Iacoviello monthly index |
| 7 | Incident rate | LIVE | Google News kinetic-incident count |
| 8 | Freight / insurance signal | EST | Heuristic war-risk multiplier |

### Aggregation Formula

```
Risk Score = 0.65 × weighted_mean(components) + 0.35 × max(components)
```

**Why not pure geometric mean?** Pure geometric was the initially proposed SOTA approach but was rejected: if one component is near zero (e.g., calm weather), the product suppresses the composite even when other signals are genuinely elevated. This masked crisis states. The `0.65·mean + 0.35·worst` blend preserves tail-risk sensitivity — the single worst component always contributes 35% of the score, so a genuine spike in any one dimension (e.g., GPR ≥ 80) cannot be averaged away.

**Why not pure max?** A pure worst-case score is dominated by noisy signals (e.g., a single M 4.1 earthquake) and loses the integrative value of the composite.

**Score interpretation:** 0–30 Low | 31–59 Moderate | 60–79 High | 80–100 Severe.

### Decomposition View
Each component's contribution is shown as `score × weight`, enabling analysts to identify which driver is responsible for the current level.

---

## 5. AIS / Vessel Data Honesty

All vessel data is badged **SIM (simulated)**. The AISStream free tier returns sparse data for the Gulf; rather than displaying empty panels, the system generates plausible mock vessels with realistic positions, headings, draughts, and flags. This is disclosed in per-panel tier badges, the methodology modal, and the DataFreshnessBadge tooltip.

Real Gulf AIS at sufficient density requires a paid Spire/MarineTraffic subscription — this is the primary paid-data gap in the current stack.

---

## 6. Architecture Decision: Scale-to-Zero

Fly.io deployment uses `min_machines_running = 0` (true stop). The hourly snapshot refresh is driven by an **external GitHub Actions cron** rather than an in-process scheduler — the machine does not need to stay running between refreshes. Cold-start latency ~2–3 seconds; cost ~$0/month at typical low traffic.
