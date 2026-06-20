"""Phase 2 / H3 — Cross-sectional equity event study around Hormuz/Gulf shocks.

Hypothesis: a Strait-of-Hormuz kinetic event produces a *cross-sectional* equity
response — tanker owners & energy names (beneficiaries of a freight/oil spike)
outperform oil-cost VICTIMS (airlines) — and the long/short basket earns abnormal
return that diffuses over [0,+10] (slower than front-month Brent, so possibly less
arbitraged). This trades the equity BASIS, not crude — the angle the price-prediction
nulls (lead-lag, Phase 1 H1/H8) leave standing.

Method (standard event study, honest about low n):
  - Market-model abnormal returns: AR = r - (alpha + beta*r_SPY), beta/alpha from a
    [-130,-20] pre-event estimation window.
  - CAR over [0,+1], [0,+5], [0,+10] (and [-5,-1] leakage check) per name.
  - Long basket (tankers, energy) vs Short basket (airlines); L/S = meanLong - meanShort.
  - Aggregate across events: mean CAR, cross-event t-stat, % positive.
  - PLACEBO: 1000 random non-event dates → bootstrap p-value for the observed L/S CAR.
  - Sanity: Brent's own move around events (did oil actually react?).

Free data via yfinance. Run: python3 research/phase2_equity_eventstudy.py
"""
from __future__ import annotations

import warnings
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")
import yfinance as yf  # noqa: E402

# ── Curated Hormuz / Persian-Gulf kinetic shipping/oil events (documented) ───
EVENTS = [
    ("2019-05-12", "Fujairah tanker sabotage (4 vessels)"),
    ("2019-06-13", "Gulf of Oman tanker attacks (Kokuka/Front Altair)"),
    ("2019-07-19", "Iran seizes Stena Impero"),
    ("2019-09-16", "Abqaiq-Khurais strike (5.7 mbpd offline; first trading day)"),
    ("2020-01-03", "Soleimani killing"),
    ("2021-07-29", "Mercer Street tanker attack"),
    ("2023-04-27", "Iran seizes Advantage Sweet in Hormuz"),
    ("2024-04-13", "Iran seizes MSC Aries near Hormuz"),
]

LONG_TANKER = ["FRO", "STNG", "DHT", "INSW", "TNK", "EURN"]   # freight-spike beneficiaries
LONG_ENERGY = ["XLE", "XOP"]                                  # oil beta
SHORT_VICTIM = ["JETS", "DAL", "LUV", "UAL"]                  # oil-cost victims (airlines)
MARKET = "SPY"
BRENT = "BZ=F"
ALL = sorted(set(LONG_TANKER + LONG_ENERGY + SHORT_VICTIM + [MARKET, BRENT]))

WINDOWS = {"[-5,-1]": (-5, -1), "[0,+1]": (0, 1), "[0,+5]": (0, 5), "[0,+10]": (0, 10)}
EST = (-130, -20)   # market-model estimation window (trading days)


def car(rets: pd.DataFrame, mkt: pd.Series, t0_idx: int, names, w):
    """Mean market-model CAR over window w for `names` around index t0."""
    a, b = w
    cars = []
    for nm in names:
        if nm not in rets:
            continue
        r = rets[nm]
        est = r.iloc[t0_idx + EST[0]: t0_idx + EST[1]]
        m_est = mkt.iloc[t0_idx + EST[0]: t0_idx + EST[1]]
        ok = est.notna() & m_est.notna()
        if ok.sum() < 40:
            continue
        beta, alpha = np.polyfit(m_est[ok], est[ok], 1)
        win = r.iloc[t0_idx + a: t0_idx + b + 1]
        mwin = mkt.iloc[t0_idx + a: t0_idx + b + 1]
        ar = win - (alpha + beta * mwin)
        if ar.notna().all():
            cars.append(float(ar.sum()))
    return np.mean(cars) if cars else np.nan


def study(rets, mkt, dates, names_long, names_short):
    """Return per-window arrays of L/S CAR across the given event dates."""
    idx = rets.index
    out = {w: [] for w in WINDOWS}
    for d in dates:
        pos = idx.searchsorted(pd.Timestamp(d))
        if pos < 140 or pos > len(idx) - 12:
            continue
        for w, ww in WINDOWS.items():
            cl = car(rets, mkt, pos, names_long, ww)
            cs = car(rets, mkt, pos, names_short, ww)
            out[w].append(cl - cs if (not np.isnan(cl) and not np.isnan(cs)) else np.nan)
    return {w: np.array([x for x in v if not np.isnan(x)]) for w, v in out.items()}


def main():
    print(f"Downloading {len(ALL)} tickers via yfinance (2018-2026)...")
    px = yf.download(ALL, start="2018-06-01", end="2026-06-20", progress=False, auto_adjust=True)["Close"]
    rets = np.log(px).diff()
    mkt = rets[MARKET]
    print(f"  prices {px.index.min().date()}→{px.index.max().date()} n_days={len(px)}")

    event_dates = [e[0] for e in EVENTS]
    long_names = LONG_TANKER + LONG_ENERGY

    rep = ["# Phase 2 / H3 — Cross-sectional equity event study\n",
           f"\n{len(EVENTS)} curated Hormuz/Gulf kinetic events 2019-2024. Long = tankers"
           f"({len(LONG_TANKER)})+energy({len(LONG_ENERGY)}); Short = airlines({len(SHORT_VICTIM)}). "
           "Market-model AR vs SPY.\n"]
    rep.append("\n**Pre-registered:** L/S CAR > 0 over [0,+5]/[0,+10] AND placebo bootstrap p<0.05. "
               "Honest caveat: n is small (event-study power is low).\n")

    # Sanity: did Brent actually move on these events?
    print("\n=== Sanity: Brent CAR (market-adjusted vs 0) around events ===")
    bcar = {w: [] for w in WINDOWS}
    idx = rets.index
    for d in event_dates:
        pos = idx.searchsorted(pd.Timestamp(d))
        if pos < 140 or pos > len(idx) - 12:
            continue
        for w, ww in WINDOWS.items():
            a, b = ww
            bcar[w].append(float(rets[BRENT].iloc[pos + a: pos + b + 1].sum()))
    for w in WINDOWS:
        arr = np.array([x for x in bcar[w] if not np.isnan(x)])
        line = f"  Brent {w:>7}: mean ret={np.nanmean(arr)*100:+.2f}% n={len(arr)}"
        print(line)

    # Main L/S event study
    print("\n=== H3: Long(tankers+energy) - Short(airlines) abnormal return ===")
    res = study(rets, mkt, event_dates, long_names, SHORT_VICTIM)
    rng = np.random.default_rng(11)
    # placebo dates: random trading days >30d from any event
    evset = set(pd.Timestamp(d).normalize() for d in event_dates)
    cand = [t for t in idx[140:-12] if all(abs((t - e).days) > 30 for e in evset)]
    placebo_dates = [str(rng.choice(cand).date()) for _ in range(1000)]
    plac = study(rets, mkt, placebo_dates, long_names, SHORT_VICTIM)

    rep.append("\n## Results — L/S (tankers+energy minus airlines) market-model CAR\n")
    rep.append("\n| Window | mean L/S CAR | t (cross-event) | % positive | placebo mean | bootstrap p |\n")
    rep.append("|---|---|---|---|---|---|\n")
    for w in WINDOWS:
        arr = res[w]
        if len(arr) == 0:
            continue
        mean = arr.mean()
        t = mean / (arr.std(ddof=1) / np.sqrt(len(arr))) if len(arr) > 1 and arr.std() > 0 else np.nan
        pospct = (arr > 0).mean() * 100
        pl = plac[w]
        p_boot = float((pl >= mean).mean()) if len(pl) else np.nan
        line = (f"  {w:>7}: L/S CAR={mean*100:+.2f}%  t={t:+.2f}  pos={pospct:.0f}%  "
                f"placebo_mean={pl.mean()*100:+.2f}%  boot_p={p_boot:.3f}  (n={len(arr)})")
        print(line)
        rep.append(f"| {w} | {mean*100:+.2f}% | {t:+.2f} | {pospct:.0f}% | "
                   f"{pl.mean()*100:+.2f}% | {p_boot:.3f} |\n")

    # Per-leg breakdown (which leg drives it)
    print("\n=== Per-leg market-adjusted CAR [0,+10] ===")
    rep.append("\n## Per-leg CAR [0,+10] (which leg drives any effect)\n\n")
    for label, names in [("Tankers", LONG_TANKER), ("Energy", LONG_ENERGY), ("Airlines(short)", SHORT_VICTIM)]:
        vals = []
        for d in event_dates:
            pos = idx.searchsorted(pd.Timestamp(d))
            if pos < 140 or pos > len(idx) - 12:
                continue
            vals.append(car(rets, mkt, pos, names, (0, 10)))
        vals = np.array([v for v in vals if not np.isnan(v)])
        line = f"  {label:>16}: mean CAR={vals.mean()*100:+.2f}% (t={vals.mean()/(vals.std(ddof=1)/np.sqrt(len(vals))):+.2f}, n={len(vals)})"
        print(line)
        rep.append(line.strip() + "\n\n")

    Path("docs/research").mkdir(parents=True, exist_ok=True)
    Path("docs/research/phase2-equity-eventstudy.md").write_text("".join(rep))
    print("\nReport → docs/research/phase2-equity-eventstudy.md")


if __name__ == "__main__":
    main()
