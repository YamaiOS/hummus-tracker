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

## Wave 3 — Risk Index v2 (DONE, deployed 2026-06-15T22:56:46.023166+00:00)
Rebuilt composite: 7 components, 6 LIVE (flow/OVX/news/weather/seismic) + 1 EST + 1 SIM,
each tier-tagged with source. Aggregation 0.65·weighted-mean + 0.35·worst (rejected pure
geometric — masked crisis). Live score 72/high. Backward-compatible output.

### Next: Wave 4 (scenario calculator), Wave 5 (data-quality tier badges in UI +
### methodology refresh), Wave 6 (GPR index, Qatar LNG disruption banner, EU gas storage).

## Waves 4-6 (DONE, deployed 2026-06-15T23:40:48.788311+00:00)
- W4: "What-If Hormuz Closes" scenario calculator (client-side; sliders → supply
  removed, Brent range, stock-buffer days; EIA/IEA params).
- W5: data-quality tier badges (LIVE/EST/SIM) on 31 panels + methodology modal refresh.
- W6: GPR geopolitical-risk index (/api/gpr, Caldara-Iacoviello via xlrd) + GPRPanel;
  Qatar LNG disruption banner (derived from Hormuz chokepoint deviation). 36 endpoints.
- QA: 0 console/page/network errors, no panel overlaps. Risk Index v2 live (72/high).
### Next: W7 EIA OPEC/Iran/Saudi production context + GPS/AIS-integrity banner;
### W8 risk decomposition + MARAD/UKMTO official incident feed.

## Waves 7-8 (DONE, deployed 2026-06-15T23:50:27.147080+00:00)
- W7: EIA OPEC/Gulf production (/api/production, real: Saudi 12.6/Iran 4.7/OPEC 35.4 mbpd)
  + GPS/AIS data-integrity banner (/api/integrity, news-derived). 38 endpoints.
- W8: GPR folded into Risk Index — now 8 components, 7 LIVE.
- FULL QA: all endpoints 200, 0 errors, no overlaps, interactions pass.
### Next: W9 MARAD/UKMTO official incident feed (higher-credibility than Google News)
### + risk-index decomposition view; W10 historical regime annotation / EU gas storage (GIE).

## Wave 9 (DONE, deployed 2026-06-16T00:27:39.969442+00:00)
- Maritime incident timeline (/api/incidents — Google News kinetic incidents,
  classified type+severity; MARAD/UKMTO are WAF-403/PDF so deferred) + panel.
- Risk Index decomposition panel (component contribution = score×weight).
- 39 endpoints. Visual review of all 3 tabs: coherent, no overlaps, tier-badged.
- GIE EU gas storage: confirmed needs registered key → DEFERRED.
## Wave 10: methodology modal refresh (incidents/production/integrity/GPR-in-index/
## decomposition/scenario) + chart regime bands. Then final QA + summary near 6h.
