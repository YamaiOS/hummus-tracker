# Phase 1 Edge Research — Findings (honest)

**Date:** 2026-06-21 · **Repro:** `python3 research/phase1_vol_edge.py`
**Data:** daily Brent (FRED `DCOILBRENTEU`), OVX (FRED `OVXCLS`, 2007+), daily GPR
(Caldara-Iacoviello `GPRD`, 1985+). **Signal** = daily GPR as a real, decades-long
**proxy** for the dashboard's live composite risk index (the live index is only weeks old).

**Discipline:** OOS R² is the primary criterion (prediction, not in-sample fit);
overlapping forward windows → Newey-West HAC SEs; tail tests cross-checked with
non-overlapping samples + a 60-day-block bootstrap. Pre-registered: a real edge
should show in **vol/tails**, not direction (the monthly lead-lag null already
killed directional prediction).

---

## H1 — Does the risk signal improve forward realized-vol forecasts beyond OVX+HAR?
**VERDICT: ❌ KILL.**

| Horizon | GPR coef (HAC t, p) | OOS R² HAR | +OVX | +GPR | Δ from GPR |
|---|---|---|---|---|---|
| 5d | +0.001 (t=0.30, p=0.77) | 0.293 | 0.433 | 0.432 | **−0.0004** |
| 10d | +0.001 (t=0.29, p=0.77) | 0.235 | 0.447 | 0.446 | **−0.0007** |
| 21d | −0.001 (t=−0.21, p=0.83) | 0.107 | 0.433 | 0.433 | **−0.0008** |

GPR adds **no** incremental vol-forecasting power once OVX and HAR lags are in the
model — coefficient insignificant, and walk-forward OOS R² gets *slightly worse*
with GPR. The risk signal is a redundant shadow of OVX for forecasting volatility.
(OVX itself is strongly predictive — HAR 0.24→0.45 OOS R² at 10d — but that's the
options market's known implied-vol signal, not ours.)

## H8 — Does a risk-signal spike raise P(Brent tail move |r|>2σ)?
**VERDICT: ⚠️ NOT ROBUST → lean KILL.**

| Test (serial-dependence handling) | Lift (top-decile vs base) | GPR significance |
|---|---|---|
| Overlapping 5d (naive) | 1.33× (23.6%→31.3%) | p<0.001 *(inflated by overlap)* |
| **Next-1d, no overlap** | 1.58× (5.8%→9.1%) | **p<0.001** |
| **Non-overlap 5d blocks (n=965)** | 1.37× | **p=0.053** (borderline) |
| **60-day block bootstrap** | 1.33× | **p=0.46** (≈ chance) |

A raw association exists (GPR high → more tails), but it **largely dissolves under
correct serial-dependence correction**: the block bootstrap — which properly accounts
for tail *clustering* — puts the lift at p=0.46 (indistinguishable from chance), and
the non-overlapping 5d test is only borderline (p=0.053). The effect is mostly
**regime confounding** (GPR and tail-vol are both elevated in the same crisis weeks),
not predictive information. Even taken at face value, a ~1.3–1.6× tail-probability
lift is **not cheaply tradable** (straddle bid/ask + theta would eat it).

## H7 — Does the dashboard detect kinetic events at/before the price reaction?
**VERDICT: ⏳ FORWARD-ACCRUING (no historical claim made).**

This is a *monitoring-latency* claim, not a backtest — it needs archived detection
timestamps we don't have historically (the news/incident feed is live-only).
**Instrumentation protocol (to accrue going forward):** for each newly-classified
kinetic incident, log (1) our incident-timeline first-seen time, (2) the first major
wire timestamp (the news item's `pubDate`), (3) the first observable Brent/OVX
reaction (daily-close proxy now; intraday if a tick source is added). Compare (1) vs
(2) and (1) vs (3). **Claim only after n≥~10 events.** Until then: no result asserted.
*(Honest gap: requires accumulating future events + ideally intraday prices.)*

---

## Bottom line
**Phase 1 found no robust, tradable edge** — both backtestable hypotheses fail a
rigorous bar (H1 cleanly, H8 under proper bootstrap). This is the correct,
evidence-first outcome: the dashboard's risk signal does **not** improve oil vol
forecasts beyond OVX, and its tail-probability "signal" is regime confounding, not
prediction. Publishing these nulls is itself a credibility asset — it proves the
tool tests its own claims.

**What this does NOT rule out (Phase 2/3, n-limited or data-gated):**
- **H3** — Hormuz-event → *cross-sectional* dispersion in MY/US energy & shipping
  equities (the weave tie-in): trades the equity *basis*, not Brent, where slow
  diffusion can survive. Untested here (needs the equity panel + event study).
- **H2/H5** — event-study abnormal vol / post-jump reversion (n≈20–40 events).
- **N3 (H7)** — the monitoring/latency *product* value, which efficient markets
  actually support and which needs no return-prediction at all.

**Recommendation:** stop chasing index→price/vol prediction (consistently null);
if continuing, move to **H3** (cross-sectional equity event study in weave) and the
**H7 latency instrumentation** — the two angles the nulls leave standing.
