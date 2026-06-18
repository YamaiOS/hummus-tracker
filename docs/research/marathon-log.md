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

## Wave 10 (DONE, deployed 2026-06-16T00:35:48.684387+00:00) — coherence/polish
- Methodology modal: full source list + derived-signals section + 8-component index.
- Chart regime bands (risk/OVX/GPR). All 3 tabs visually reviewed: coherent, no overlaps.
- 1.78h elapsed. Feature backlog now largely blocked (EU storage=key, official feeds=WAF,
  real AIS=paid). PIVOTING remaining marathon time to HARDENING (higher value than padding):
## Wave 11+: persistent alerts for new signals (OVX/GPR/incident/chokepoint), backend
## pytest smoke tests for the 13 new services, bundle/perf check. Then final QA + summary.

## Waves 11-12 (DONE, deployed 2026-06-16T01:13:31.032255+00:00) — hardening
- W11: +4 persistent alerts (OVX high / GPR severe / critical incident 24h / Hormuz
  chokepoint <60%) in snapshot _evaluate_alerts; tests/test_services.py (14 smoke
  tests, all green); pytest.ini excludes manual scripts → full suite 17 passed.
- W12: bundle healthy (no 500KB warning; vendors+tabs lazy-split, main 70KB);
  mobile 390px: 0 errors, no h-overflow, fully usable. All QA clean.
- ~2.5h elapsed. Feature backlog exhausted (free data); core + hardening complete.

## Checkpoint 2026-06-16T02:23:42.137601+00:00 (3.5h elapsed) — verify pass
All 39 endpoints 200, 0 console/page/net errors, no panel overlaps. Triggered a
refresh (GitHub scheduled cron is best-effort/bursty — 00:26 run fired; 01:00/02:00
delayed by GH). App hardened + healthy. Holding for the 6h final summary.
## Checkpoint 2026-06-16T03:27:26.155821+00:00 (4.6h) — all green: 39 endpoints 200, 0 errors, no overlaps; refreshed.
## Checkpoint 2026-06-16T04:30:50.066001+00:00 (5.7h) — all green; finalizing at 6h.

## ✅ MARATHON COMPLETE (6.27h, ended 2026-06-16T05:04 UTC)
12 waves + hardening. 39 endpoints, 13 new free-data feeds, Risk Index v2 (8 comp/7 LIVE).
Final QA: 0 console/page/net errors, no panel overlaps, 17 pytest passed, mobile clean,
bundle healthy. Still $0 scale-to-zero. Live: https://oil.yieldwise.my.
Deferred: GIE EU gas storage (needs key), MARAD/UKMTO (WAF-403), real Gulf AIS (paid → vessels SIM).

## Strategy sprint 2026-06-16T22:48:09.163786+00:00 — distribution + moat + liability + backtest (4 Opus think→4 Opus build)
RSS /feed.xml + /card.svg; atomic writes + history validation; disclaimer/ToS; /api/backtest event study.
40 endpoints, 17 tests pass, 0 errors/overlaps. Deferred: demote SIM map, Telegram push, Fly scheduled refresh.

## Follow-up sprint 2026-06-16T23:18:44.547131+00:00 (Opus agents) — trust + distribution + reliability
- Real "Strait Transit Monitor" (IMF PortWatch) now LEADS Operations; simulated vessel
  map DEMOTED to a labeled "Vessel Map (Simulated Demo)" — #1 reputational fix.
- Telegram daily digest (alerts.send_daily_digest) wired into snapshot; no-ops until
  TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID secrets set (create bot via @BotFather).
- RELIABLE REFRESH: Fly scheduled machine 'hourly-refresh-cron' (curlimages/curl,
  --entrypoint /bin/sh, --schedule hourly, 256MB, region sin) POSTs the token-protected
  /api/internal/refresh hourly — verified end-to-end (auth ok, snapshot advanced).
  GitHub Actions cron retained as backup; refresh lock prevents double-runs.
- QA: 0 errors, no real overlaps, 17 tests pass.

## Session 2026-06-18T10:54:06.161694+00:00 — lead-lag + distribution polish
- Risk↔Brent relationship panel (preliminary lead-lag, n<24 gated, honestly caveated) — Analytics.
- RSS autodiscovery <link> in head (feed readers/browsers find /feed.xml). /card.svg + /feed.xml live (200).
- State: 39 endpoints, hourly Fly cron keeping data fresh (snap current), QA 0 errors, 17 tests. Self-maintaining.
- Open: Telegram secrets (user), lead-lag matures w/ ~3-4wk history, real AIS (paid).

## Session 2026-06-18T11:23:29.009393+00:00 — Risk Index component freshness (credibility #6)
- Each component now carries as_of/age_hours/stale (cadence-aware: GPR>45d, daily>60h, real-time never) + top-level freshness summary; RiskDecomposition shows "as of X ago" + STALE chips. Additive, score unchanged. Live: stale=[Strait Flow, GPR, Seismic]. 17 tests pass, 0 QA errors.
