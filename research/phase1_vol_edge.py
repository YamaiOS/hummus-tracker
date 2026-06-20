"""Phase 1 edge research — does a Hormuz/geopolitical risk signal carry edge?

Tests two backtestable hypotheses on FREE daily data (2007+):
  H1  — Daily GPR improves FORWARD realized-vol forecasts of Brent BEYOND OVX+HAR
        (incremental in-sample HAC t-stat AND walk-forward out-of-sample R²).
  H8  — A risk-signal spike raises the probability of a Brent TAIL move (|r|>2σ),
        beyond the base rate, controlling for OVX.

Signal proxy = Caldara-Iacoviello DAILY GPR (GPRD) — a real, daily, decades-long
geopolitical-risk series (the live composite index is only weeks old). This is a
PROXY for the dashboard's risk index, stated honestly.

Decision discipline (matches the lead-lag null + weave's evidence-first rule):
  - OOS R² improvement is the PRIMARY criterion (prediction, not in-sample fit).
  - Overlapping forward windows ⇒ Newey-West HAC standard errors for inference.
  - Pre-registered: GPR should help VOL (H1) and TAILS (H8), NOT direction.
  - Honest pass/kill thresholds stated before looking.

Run:  python3 research/phase1_vol_edge.py
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
FRED_KEY = os.getenv("FRED_API_KEY", "")
GPRD_URL = "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls"

import httpx  # noqa: E402


# ── Data ─────────────────────────────────────────────────────────────────────
def fred_series(series_id: str) -> pd.Series:
    url = "https://api.stlouisfed.org/fred/series/observations"
    params = {"series_id": series_id, "api_key": FRED_KEY, "file_type": "json"}
    r = httpx.get(url, params=params, timeout=40.0)
    r.raise_for_status()
    obs = r.json()["observations"]
    s = pd.Series(
        {pd.Timestamp(o["date"]): (float(o["value"]) if o["value"] not in (".", "") else np.nan)
         for o in obs},
        name=series_id,
    ).sort_index()
    return s.dropna()


def load_gprd() -> pd.Series:
    raw = httpx.get(GPRD_URL, timeout=60.0).content
    df = pd.read_excel(io.BytesIO(raw))
    df["date"] = pd.to_datetime(df["DAY"].astype(int).astype(str), format="%Y%m%d")
    return df.set_index("date")["GPRD"].dropna().sort_index()


# ── OLS with Newey-West HAC standard errors ──────────────────────────────────
def ols_hac(y: np.ndarray, X: np.ndarray, L: int):
    """Return (beta, hac_se, tstat, pval, r2). X must include an intercept col."""
    beta, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    n, k = X.shape
    XtX_inv = np.linalg.inv(X.T @ X)
    S = X * resid[:, None]                      # n×k score
    Omega = S.T @ S
    for l in range(1, L + 1):                   # Newey-West (Bartlett) kernel
        w = 1.0 - l / (L + 1.0)
        G = S[l:].T @ S[:-l]
        Omega += w * (G + G.T)
    cov = XtX_inv @ Omega @ XtX_inv
    se = np.sqrt(np.diag(cov))
    t = beta / se
    p = 2 * (1 - stats.t.cdf(np.abs(t), df=n - k))
    ss_res = float(resid @ resid)
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - ss_res / ss_tot
    return beta, se, t, p, r2


def oos_r2(df: pd.DataFrame, ycol: str, feature_sets: dict, min_train: int = 1000, refit: int = 21):
    """Expanding-window walk-forward 1-step OOS R² for each feature set.

    Refits every `refit` rows (monthly) for speed; predicts each row from a model
    trained only on strictly-earlier data. OOS R² vs the train-mean benchmark.
    """
    y = df[ycol].to_numpy()
    n = len(df)
    out = {}
    for name, cols in feature_sets.items():
        X = np.column_stack([np.ones(n)] + [df[c].to_numpy() for c in cols])
        preds = np.full(n, np.nan)
        bench = np.full(n, np.nan)
        beta = None
        for i in range(min_train, n):
            if beta is None or (i - min_train) % refit == 0:
                Xtr, ytr = X[:i], y[:i]
                beta, _, _, _ = np.linalg.lstsq(Xtr, ytr, rcond=None)
                ymean = ytr.mean()
            preds[i] = X[i] @ beta
            bench[i] = ymean
        mask = ~np.isnan(preds)
        ss_res = float(((y[mask] - preds[mask]) ** 2).sum())
        ss_ben = float(((y[mask] - bench[mask]) ** 2).sum())
        out[name] = 1 - ss_res / ss_ben          # OOS R² vs expanding-mean benchmark
    return out


def main():
    print("Loading data (FRED Brent + OVX, daily GPR)...")
    brent = fred_series("DCOILBRENTEU")
    ovx = fred_series("OVXCLS")
    gprd = load_gprd()
    print(f"  Brent {brent.index.min().date()}→{brent.index.max().date()} n={len(brent)}")
    print(f"  OVX   {ovx.index.min().date()}→{ovx.index.max().date()} n={len(ovx)}")
    print(f"  GPRD  {gprd.index.min().date()}→{gprd.index.max().date()} n={len(gprd)}")

    df = pd.DataFrame({"brent": brent}).dropna()
    df["ret"] = np.log(df["brent"]).diff()
    # Annualized realized vol over a window of daily log returns
    ANN = np.sqrt(252)
    for h in (5, 10, 21):
        df[f"rv_fwd{h}"] = df["ret"].rolling(h).std().shift(-h) * ANN     # forward (no peek)
    df["rv_lag1"] = df["ret"].abs() * ANN
    df["rv_lag5"] = df["ret"].rolling(5).std() * ANN
    df["rv_lag22"] = df["ret"].rolling(22).std() * ANN
    df["ovx"] = ovx.reindex(df.index).ffill(limit=3)
    df["gprd"] = gprd.reindex(df.index).ffill(limit=5)
    df["gprd_ma7"] = df["gprd"].rolling(7).mean()
    # standardize the signal for interpretable coefficients
    df["gprd_z"] = (df["gprd"] - df["gprd"].rolling(252, min_periods=60).mean()) \
        / df["gprd"].rolling(252, min_periods=60).std()

    report = []
    report.append("# Phase 1 Edge Research — Findings\n")
    report.append(f"Data: Brent+OVX+GPRD daily, {df.index.min().date()}→{df.index.max().date()}. "
                  "Signal = daily GPR (proxy for the live composite risk index).\n")

    # ── H1: incremental vol forecasting ──────────────────────────────────────
    report.append("\n## H1 — Does GPR improve forward realized-vol forecasts beyond OVX+HAR?\n")
    report.append("Pre-registered pass: GPR coeff HAC-significant (p<0.05) AND walk-forward "
                  "OOS R²(HAR+OVX+GPR) > OOS R²(HAR+OVX). Kill: GPR is an OVX shadow (no lift).\n")
    print("\n=== H1: forward realized vol ===")
    for h in (5, 10, 21):
        d = df.dropna(subset=[f"rv_fwd{h}", "rv_lag1", "rv_lag5", "rv_lag22", "ovx", "gprd_z"]).copy()
        y = d[f"rv_fwd{h}"].to_numpy()
        har = ["rv_lag1", "rv_lag5", "rv_lag22"]
        Xfull = np.column_stack([np.ones(len(d))] + [d[c].to_numpy() for c in har + ["ovx", "gprd_z"]])
        beta, se, t, p, r2 = ols_hac(y, Xfull, L=h)
        names = ["const"] + har + ["ovx", "gprd_z"]
        gi = names.index("gprd_z")
        oos = oos_r2(d, f"rv_fwd{h}",
                     {"HAR": har, "HAR+OVX": har + ["ovx"], "HAR+OVX+GPR": har + ["ovx", "gprd_z"]})
        line = (f"  h={h:>2}d n={len(d)}: GPR coef={beta[gi]:+.3f} "
                f"HAC t={t[gi]:+.2f} p={p[gi]:.3f} | OOS R²  HAR={oos['HAR']:.3f} "
                f"+OVX={oos['HAR+OVX']:.3f} +GPR={oos['HAR+OVX+GPR']:.3f} "
                f"(Δ={oos['HAR+OVX+GPR']-oos['HAR+OVX']:+.4f})")
        print(line)
        report.append(line + "\n")

    # ── H8: tail probability ─────────────────────────────────────────────────
    report.append("\n## H8 — Does a GPR spike raise P(Brent tail move |r|>2σ next 5d)?\n")
    report.append("Pre-registered pass: P(tail | GPR top decile) materially > base rate, and "
                  "GPR significant in a logistic with OVX. Kill: equals base rate given OVX.\n")
    print("\n=== H8: tail probability ===")
    d = df.dropna(subset=["ret", "ovx", "gprd"]).copy()
    sigma = d["ret"].rolling(60).std()
    d["tail"] = (d["ret"].abs() > 2 * sigma).astype(float)
    d["tail_fwd5"] = d["tail"].rolling(5).max().shift(-5)          # any tail in next 5d
    d = d.dropna(subset=["tail_fwd5", "gprd"])
    base = d["tail_fwd5"].mean()
    q90 = d["gprd"].quantile(0.90)
    q50 = d["gprd"].quantile(0.50)
    p_hi = d.loc[d["gprd"] >= q90, "tail_fwd5"].mean()
    p_mid = d.loc[(d["gprd"] >= q50) & (d["gprd"] < q90), "tail_fwd5"].mean()
    p_lo = d.loc[d["gprd"] < q50, "tail_fwd5"].mean()
    # logistic: tail_fwd5 ~ ovx + gprd_z   (control for OVX)
    dd = d.dropna(subset=["gprd_z"]).copy()
    Xl = np.column_stack([np.ones(len(dd)), dd["ovx"].to_numpy(),
                          ((dd["gprd"] - dd["gprd"].mean()) / dd["gprd"].std()).to_numpy()])
    yl = dd["tail_fwd5"].to_numpy()
    bl, pl = _logit(Xl, yl)
    line1 = (f"  [overlapping 5d] base P(tail)={base:.3f} | P|GPR<median={p_lo:.3f} "
             f"mid={p_mid:.3f} top-decile={p_hi:.3f} (lift={p_hi/base:.2f}x)")
    line2 = (f"  [overlapping 5d] logistic tail~OVX+GPR: OVX coef={bl[1]:+.3f} p={pl[1]:.3f} | "
             f"GPR coef={bl[2]:+.3f} p={pl[2]:.3f}  (p inflated by overlap)")
    print(line1); print(line2)
    report.append(line1 + "\n" + line2 + "\n")

    # ── H8 ROBUSTNESS: kill the overlap artifact ─────────────────────────────
    # (a) Non-overlapping next-1-DAY tail (no window overlap at all).
    d1 = df.dropna(subset=["ret", "ovx", "gprd"]).copy()
    sig1 = d1["ret"].rolling(60).std()
    d1["tail1"] = (d1["ret"].abs() > 2 * sig1).astype(float)
    d1["tail1_fwd"] = d1["tail1"].shift(-1)
    d1 = d1.dropna(subset=["tail1_fwd"])
    base1 = d1["tail1_fwd"].mean()
    p_hi1 = d1.loc[d1["gprd"] >= d1["gprd"].quantile(0.90), "tail1_fwd"].mean()
    Xl1 = np.column_stack([np.ones(len(d1)), d1["ovx"].to_numpy(),
                           ((d1["gprd"] - d1["gprd"].mean()) / d1["gprd"].std()).to_numpy()])
    bl1, pl1 = _logit(Xl1, d1["tail1_fwd"].to_numpy())
    # (b) Non-overlapping 5d blocks (every 5th obs) for the 5d test.
    d5 = d.iloc[::5].copy()
    base5 = d5["tail_fwd5"].mean()
    p_hi5 = d5.loc[d5["gprd"] >= d5["gprd"].quantile(0.90), "tail_fwd5"].mean()
    Xl5 = np.column_stack([np.ones(len(d5)), d5["ovx"].to_numpy(),
                           ((d5["gprd"] - d5["gprd"].mean()) / d5["gprd"].std()).to_numpy()])
    bl5, pl5 = _logit(Xl5, d5["tail_fwd5"].to_numpy())
    # (c) Block-bootstrap p-value for the top-decile lift (60-day contiguous blocks).
    rng = np.random.default_rng(7)
    obs_lift = p_hi / base
    g = d["gprd"].to_numpy(); tl = d["tail_fwd5"].to_numpy(); n = len(d); bs = 60
    boot = []
    for _ in range(2000):
        idx = []
        while len(idx) < n:
            s0 = rng.integers(0, n - bs)
            idx.extend(range(s0, s0 + bs))
        idx = np.array(idx[:n])
        gg, tt = g[idx], tl[idx]
        thr = np.quantile(gg, 0.90)
        b = tt.mean()
        boot.append((tt[gg >= thr].mean() / b) if b > 0 else np.nan)
    boot = np.array([x for x in boot if np.isfinite(x)])
    p_boot = float((boot >= obs_lift).mean())
    rl = [
        f"  [robust a · next-1d, no overlap] base={base1:.3f} top-decile={p_hi1:.3f} "
        f"(lift={p_hi1/base1:.2f}x) | logistic GPR coef={bl1[2]:+.3f} p={pl1[2]:.3f}",
        f"  [robust b · non-overlap 5d blocks n={len(d5)}] base={base5:.3f} top-decile={p_hi5:.3f} "
        f"(lift={p_hi5/base5:.2f}x) | logistic GPR coef={bl5[2]:+.3f} p={pl5[2]:.3f}",
        f"  [robust c · block-bootstrap] observed lift={obs_lift:.2f}x, "
        f"bootstrap p(lift≥observed by chance)={p_boot:.3f}",
    ]
    for r in rl:
        print(r); report.append(r + "\n")

    Path("docs/research").mkdir(parents=True, exist_ok=True)
    Path("docs/research/phase1-vol-edge-findings.md").write_text("".join(report))
    print("\nReport → docs/research/phase1-vol-edge-findings.md")


def _logit(X, y, iters=100):
    """Tiny Newton-Raphson logistic regression → (beta, pvals)."""
    beta = np.zeros(X.shape[1])
    for _ in range(iters):
        eta = X @ beta
        mu = 1 / (1 + np.exp(-eta))
        W = mu * (1 - mu)
        XtW = X.T * W
        H = XtW @ X
        grad = X.T @ (y - mu)
        try:
            step = np.linalg.solve(H, grad)
        except np.linalg.LinAlgError:
            break
        beta = beta + step
        if np.max(np.abs(step)) < 1e-8:
            break
    cov = np.linalg.inv(H)
    se = np.sqrt(np.diag(cov))
    z = beta / se
    p = 2 * (1 - stats.norm.cdf(np.abs(z)))
    return beta, p


if __name__ == "__main__":
    main()
