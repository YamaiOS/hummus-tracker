# Phase 2 / H3 — Cross-sectional equity event study (honest)

**Date:** 2026-06-21 · **Repro:** `python3 research/phase2_equity_eventstudy.py`
**Data:** daily prices via yfinance (auto-adjusted), 2018–2026.
**Events (n=8):** documented Hormuz/Persian-Gulf kinetic shocks — Fujairah sabotage
(2019-05), Gulf of Oman attacks (2019-06), Stena Impero seizure (2019-07), Abqaiq
strike (2019-09), Soleimani (2020-01), Mercer Street (2021-07), Advantage Sweet seizure
(2023-04), MSC Aries seizure (2024-04).
**Baskets:** Long = tankers (FRO, STNG, DHT, INSW, TNK; EURN delisted/merged 2023 →
silently dropped, long basket = 7 names) + energy (XLE, XOP); Short = airlines
(JETS, DAL, LUV, UAL). Market-model abnormal returns vs SPY + placebo bootstrap.

**Pre-registered pass:** L/S CAR > 0 over [0,+5]/[0,+10] AND placebo bootstrap p<0.05.

---

## Sanity — did Brent actually react? (yes, then it reverts)
| Window | Brent mean return |
|---|---|
| [-5,-1] | −2.04% |
| **[0,+1]** | **+2.65%** |
| [0,+5] | +0.17% |
| [0,+10] | −0.27% |

Oil jumps ~2.6% on the event day/next day, then **fully reverts within a week** — the
premium is priced fast and fades. This is the mechanism behind the price/return nulls.

## H3 result — no significant cross-sectional edge
| Window | mean L/S CAR | t (cross-event) | % positive | placebo mean | bootstrap p |
|---|---|---|---|---|---|
| [-5,-1] | −1.87% | −1.18 | 38% | +0.34% | 0.652 |
| [0,+1] | +0.85% | +1.25 | 75% | −0.11% | 0.382 |
| [0,+5] | −2.48% | −0.89 | 50% | +0.22% | 0.668 |
| [0,+10] | −2.58% | −1.10 | 38% | +0.51% | 0.625 |

**VERDICT: ❌ KILL.** The only flicker is a weakly-positive day-1 pop (+0.85%, 75% of
events positive) — not significant (bootstrap p=0.38) and it **reverses** to −2.6% over
[0,+10]. No window beats the placebo. *(This Phase-2 placebo bootstrap is methodologically
sound — it resamples random non-event dates and was independently validated; unlike the
Phase-1 H8 bug, which was corrected.)*

## Per-leg [0,+10] — the thesis doesn't even hold directionally
| Basket | mean CAR [0,+10] | t |
|---|---|---|
| Tankers | **−3.40%** | −1.28 |
| Energy | −1.04% | −0.81 |
| Airlines (short leg) | −0.14% | −0.09 |

Tankers — the supposed purest *beneficiary* — actually **underperform** post-event.
Airlines (the supposed *victim*) are flat. The freight-spike→tanker-equity story doesn't
show at the daily horizon. **Power caveat:** n=8 is small; a small effect can't be ruled
out, but the point estimates run *against* the thesis and placebo is nowhere near
significant.

---

## Cross-phase synthesis — the edge research, concluded honestly
Four independent rigorous tests (H8 corrected after adversarial validation caught a
bootstrap bug):

| Test | Result |
|---|---|
| Lead-lag: index → Brent monthly returns (n=125) | **NULL** (peak r=−0.15, inside CI) |
| **H1**: signal → forward realized vol, beyond OVX | **KILL** (OOS R² Δ negative) |
| **H8**: signal → Brent tail probability | **REAL BUT WEAK** (rotation-null p=0.012; but marginal-over-OVX p=0.053, modest, not tradable) |
| **H3**: Hormuz event → cross-sectional equity L/S | **KILL** (no sig; signs against thesis) |

**Conclusion: no *tradable* edge.** The signal doesn't beat OVX for oil risk, doesn't
predict returns, and shows no exploitable equity cross-section. The one statistically
real effect (H8 tail association) is largely redundant with OVX and too small to trade
after costs. Markets price geopolitical risk fast (Brent +2.6% then reverts in a week).
Establishing this cheaply, with rigor — and catching our own test bug via adversarial
review — is the win (weave evidence-first discipline).

**Therefore the product's value is monitoring / detection / transparent synthesis (H7),
NOT alpha** — which is what the dashboard already does well.
