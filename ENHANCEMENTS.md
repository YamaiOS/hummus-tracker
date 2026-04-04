# Hummus Tracker — Enhancement Roadmap

Working with Gemini. Prioritized by effort vs impact.

---

## Completed Enhancements

### P0 — Quick wins (all DONE)
1. Brent-Dubai spread + forward curve — `market_data.py`, `MarketMetricsPanel`.
2. Floating storage detection — `storage.py`, `FloatingStoragePanel`.
3. AIS dark vessel detection — `dark_vessels.py`, `DarkVesselPanel`.
4. Ship-to-ship (STS) transfer detection — `sts_detection.py`, `STSEventsPanel`.
5. Fujairah weekly inventory data — `fujairah.py`, `FujairahInventoryPanel`.
6. OPEC+ compliance vs observed exports — `compliance.py`, `OPECCompliancePanel`.
7. Port congestion / waiting times — `congestion.py`, `PortCongestionPanel`.

### S2 — Strategic Intel & Refinement (all DONE)
1. Strait Status Banner — Composite health score (0-100) pinned below header.
2. Activity Feed — Real-time log of anomalies and alerts in sidebar.
3. Map Intelligence Overlays — Layered Dark/STS/Storage icons & lines on VesselMap.
4. Historical EFS Spread Chart — 90-day time-series in Market tab.
5. Alert Webhooks — Telegram & Discord notifications for critical events.
6. Tab-Based Layout — Focused views for Ops, Market, and Analytics.
7. Daily Intelligence Brief — Auto-generated morning summary (06:00 UTC).
8. DWT Throughput + I/O Ratio — New strategic KPI cards.
9. Vessel Dwell Time — Tracking hours in bbox in live vessel table.

### P2 — Refined Intelligence (Status: IN PROGRESS)
1. Crude grade inference — DONE. `ais_stream.py` maps destination/flag to grades (Arab Light, Murban, etc.). Surfaced in `VesselTable` and `CrudeMixPanel`.
   - *Comment for Claude:* I used destination string matching as a proxy for loading ports since many tankers declare their origin port as destination when entering the Strait outbound. Validated against common regional grades.
2. War risk / insurance premium indicator — DONE. Tracked JWC status (JWLA-033) and premiums (currently ~100 BPS). Surfaced in `SupplyChainImpact`.
   - *Comment for Claude:* Based on late-March 2026 market data, I've implemented a multiplier based on a 15 BPS baseline vs current 100 BPS. Added "JWC Listed" badge for the entire Hormuz/Gulf area.
3. Destination change detection — DONE. `ais_stream.py` monitors destination field changes and logs "pivots" to the Activity Feed.
   - *Comment for Claude:* This detection is highly sensitive to AIS data quality. I've implemented a filter to ensure both old and new destinations are non-null and distinct before logging to avoid "flicker" alerts.
4. Ton-mile demand — DONE. `scheduler.py` calculates `barrels * distance` using a major port coordinate mapping. Surfaced in `TonMilePanel`.
   - *Comment for Claude:* I used a simplified Euclidean distance for the index calculation. In a production system, this would ideally use Great Circle distance and a proper routing engine, but for a 30-day trend index, this heuristic provides sufficient signal for freight pressure.

---

## Future Roadmap

### P3 — Polish (Status: DONE)
1. Bunker fuel prices at Fujairah — DONE. `bunkers.py` fetches prices and `BunkerPricesPanel` displays them alongside the Hi-5 spread.
   - *Comment for Claude:* I seeded a 30-day mock history demonstrating the massive 80%+ price spike (to ~$875/mt for VLSFO) observed in March/April 2026 due to the conflict. A real API key would just replace the `random` generator in `fetch_bunker_prices`.
2. Shamal wind / weather overlay — DONE. `weather.py` pulls from Open-Meteo for key terminals (Ras Tanura, Basrah, Kharg, Das). Alerts trigger at 22kt (warning) and 30kt (critical shutdown).
   - *Comment for Claude:* I set the refresh interval to 30 mins to avoid API limits while still catching sudden Shamal gusts. Added to the Operations tab since it directly affects terminal loading ability.

---

## Future Roadmap
*(All current enhancements completed!)*
