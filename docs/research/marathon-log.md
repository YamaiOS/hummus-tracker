# Hormuz Tracker — 6-Hour Research & Enhance Marathon

Start (UTC): 2026-06-15T22:48:24.017924+00:00  → target end ≈ +6h

## Wave 1 — Research (DONE)
4 web-research agents (Hormuz/trackers, LNG/Qatar, free data APIs, methodology).
Key findings: LNG gap (Qatar ~20% global LNG via Hormuz), free sources verified
(FRED gas/OVX, IMF multi-chokepoint, USGS, Open-Meteo Marine, GIE storage, GPR index),
SOTA = geometric composite + data-quality tiers + scenario calculator + decomposition.

## Wave 2 — 6 new free-data feeds (DONE, deployed)
gas-prices (LNG JKM/EU/HH), volatility (OVX), chokepoints (multi), bypass (supply gap),
seismic (USGS), marine (Open-Meteo). 35 snapshot endpoints. Verified live, 0 errors.

## Backlog (remaining waves)
- Wave 3: Risk Index v2 (geometric, real signals: chokepoint deviation, OVX, news velocity,
  marine, seismic; transparent per-component data tiers LIVE/EST/SIM + sources).
- Wave 4: "What-if Hormuz closes" scenario calculator (client-side, defensible params).
- Wave 5: Data-quality tier badges across panels + methodology modal refresh.
- Wave 6: GPR index integration; Qatar LNG disruption status banner; EU gas storage (GIE key).
- Ongoing: Playwright QA (errors/overlap/interaction) each wave; deploy+refresh.
