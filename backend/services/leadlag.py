"""Historical Lead-Lag Analysis — GPR/OVX proxy vs Brent monthly returns.

Uses multi-year MONTHLY history (n≈100+) for real statistical power.
Cross-correlation of proxy_index[t] vs brent_return[t+k] for k in -6..+6.
Positive k means the risk proxy LEADS Brent returns by k months.

Defensive: never raises; returns {lags:[], insufficient:True, ...} when n<24.
Cache: 24h (monthly cadence, no need to refetch more often).
"""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
_START = "2016-01"    # Aim 2016→now to maximise n; overlap with OVX+GPR history
_WEIGHTS = {"gpr": 0.55, "ovx": 0.45}   # mirrors backtest.py exactly

_CACHE: Optional[tuple] = None  # (result, fetched_at)
_CACHE_TTL = 24 * 3600          # 24h — monthly cadence


# ── Normalisation (identical to backtest.py) ─────────────────────────────────

def _normalize_gpr(gpr: float) -> float:
    return max(0.0, min(100.0, (gpr - 50.0) / 2.5))


def _normalize_ovx(ovx: float) -> float:
    return max(0.0, min(100.0, (ovx - 15.0) / 65.0 * 100.0))


# ── Data helpers (replicate backtest.py's monthly fetch approach) ────────────

async def _gpr_monthly(start: str) -> Dict[str, float]:
    """Month-keyed GPR values from gpr service history. Returns {} on failure."""
    try:
        from .gpr import get_gpr
        data = await get_gpr()
        out: Dict[str, float] = {}
        for h in (data.get("history") or []):
            m = (h.get("month") or "")[:7]
            g = h.get("gpr")
            if m and m >= start and g is not None:
                out[m] = float(g)
        return out
    except Exception as exc:
        logger.warning("leadlag: GPR monthly failed: %s", exc)
        return {}


async def _ovx_monthly(start: str) -> Dict[str, float]:
    """Month-averaged OVX from FRED OVXCLS. Returns {} on failure."""
    try:
        from .volatility import _fetch_series, OVX_SERIES, _API_KEY  # type: ignore
        if not _API_KEY:
            return {}
        raw = await _fetch_series(OVX_SERIES, start + "-01")
        agg: Dict[str, List[float]] = {}
        for r in raw or []:
            d = r.get("date", "")
            v = r.get("value")
            if not d or v is None:
                continue
            agg.setdefault(d[:7], []).append(float(v))
        return {m: sum(vs) / len(vs) for m, vs in agg.items() if vs}
    except Exception as exc:
        logger.warning("leadlag: OVX monthly failed: %s", exc)
        return {}


async def _brent_monthly(start: str) -> Dict[str, float]:
    """Month-averaged Brent from FRED DCOILBRENTEU. Returns {} on failure."""
    try:
        from .fred import _fetch_series, BRENT_SERIES, _API_KEY  # type: ignore
        if not _API_KEY:
            return {}
        raw = await _fetch_series(BRENT_SERIES, start + "-01")
        agg: Dict[str, List[float]] = {}
        for r in raw or []:
            d = r.get("date", "")
            v = r.get("value")
            if not d or v is None:
                continue
            agg.setdefault(d[:7], []).append(float(v))
        return {m: round(sum(vs) / len(vs), 2) for m, vs in agg.items() if vs}
    except Exception as exc:
        logger.warning("leadlag: Brent monthly failed: %s", exc)
        return {}


# ── Statistics ────────────────────────────────────────────────────────────────

def _pearson(xs: List[float], ys: List[float]) -> Optional[float]:
    """Pearson r. Returns None on n<2, length mismatch, or zero variance."""
    n = len(xs)
    if n < 2 or len(ys) != n:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxy = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    denom = math.sqrt(sxx * syy)
    if denom == 0 or not math.isfinite(denom):
        return None
    r = sxy / denom
    return r if math.isfinite(r) else None


def _log_return(prev: float, curr: float) -> Optional[float]:
    """Monthly log-return: ln(curr/prev). Returns None on non-positive values."""
    if prev <= 0 or curr <= 0:
        return None
    try:
        return math.log(curr / prev)
    except Exception:
        return None


def _pct_return(prev: float, curr: float) -> Optional[float]:
    """Monthly % return. Returns None on zero prev."""
    if prev == 0:
        return None
    return (curr - prev) / prev


# ── Main computation ──────────────────────────────────────────────────────────

async def get_leadlag() -> dict:
    """Build lead-lag analysis over full monthly history. Never raises."""
    global _CACHE
    now = time.time()
    if _CACHE is not None:
        result, ts = _CACHE
        if now - ts < _CACHE_TTL:
            return result

    updated_at = datetime.utcnow().isoformat() + "Z"
    base: Dict[str, Any] = {
        "lags": [],
        "peak": None,
        "contemporaneous_level_r": None,
        "n": 0,
        "span": None,
        "ci95": None,
        "interpretation": "Data unavailable.",
        "methodology": (
            "Monthly proxy index (0.55*GPR_norm + 0.45*OVX_norm, same weights/normalisation as "
            "the backtest event study) cross-correlated with monthly Brent LOG-returns. "
            "Lags k = -6..+6 months; positive k = risk proxy LEADS Brent returns by k months. "
            "95% CI = ±1.96/√n_k (Fisher-z approximation). Peak lag = argmax |r|."
        ),
        "disclaimer": "Monthly GPR+OVX proxy (NOT the live composite); correlation≠causation; n subject to overlap availability.",
        "source": "FRED OVX (OVXCLS) + FRED Brent (DCOILBRENTEU) + Caldara-Iacoviello GPR",
        "updated_at": updated_at,
    }

    try:
        gpr_raw = await _gpr_monthly(_START)
        ovx_raw = await _ovx_monthly(_START)
        brent_raw = await _brent_monthly(_START)
    except Exception as exc:
        logger.error("leadlag: source gather failed: %s", exc)
        return base

    # ── Build monthly proxy index ──────────────────────────────────────────────
    # Only months where at least one of GPR/OVX is available.
    months_proxy = sorted(set(gpr_raw) | set(ovx_raw))
    proxy_by_month: Dict[str, float] = {}

    for m in months_proxy:
        if m < _START:
            continue
        gn = _normalize_gpr(gpr_raw[m]) if m in gpr_raw else None
        on = _normalize_ovx(ovx_raw[m]) if m in ovx_raw else None
        parts = []
        if gn is not None:
            parts.append((gn, _WEIGHTS["gpr"]))
        if on is not None:
            parts.append((on, _WEIGHTS["ovx"]))
        if not parts:
            continue
        tw = sum(w for _, w in parts)
        proxy_by_month[m] = sum(v * w for v, w in parts) / tw

    # ── Build Brent monthly LOG returns ───────────────────────────────────────
    brent_sorted = sorted(brent_raw.keys())
    brent_return_by_month: Dict[str, float] = {}
    for i in range(1, len(brent_sorted)):
        m_curr = brent_sorted[i]
        m_prev = brent_sorted[i - 1]
        if m_curr < _START:
            continue
        lr = _log_return(brent_raw[m_prev], brent_raw[m_curr])
        if lr is not None:
            brent_return_by_month[m_curr] = lr

    # ── Contemporaneous level correlation: proxy_index vs brent_level ─────────
    common_level = sorted(set(proxy_by_month) & set(brent_raw))
    contemp_level_r: Optional[float] = None
    if len(common_level) >= 2:
        xi = [proxy_by_month[m] for m in common_level]
        yi = [brent_raw[m] for m in common_level]
        contemp_level_r = _pearson(xi, yi)
        if contemp_level_r is not None:
            contemp_level_r = round(contemp_level_r, 4)

    # ── Cross-correlation: proxy_index[t] vs brent_return[t+k] ───────────────
    # Enumerate all months that have both a proxy and a brent-return, sorted.
    base_months = sorted(set(proxy_by_month) & set(brent_return_by_month))

    if len(base_months) < 24:
        n_available = len(base_months)
        result = dict(base)
        result["n"] = n_available
        result["insufficient"] = True
        result["interpretation"] = (
            f"Insufficient overlapping data: only {n_available} months with both proxy and "
            "Brent returns available (need ≥24). Check FRED_API_KEY environment variable."
        )
        result["disclaimer"] = f"Monthly GPR+OVX proxy (NOT the live composite); correlation≠causation; n≈{n_available} months."
        _CACHE = (result, now)
        return result

    # Index months for O(1) lookup
    month_idx: Dict[str, int] = {m: i for i, m in enumerate(base_months)}

    lags: List[Dict[str, Any]] = []
    MAX_LAG = 6

    for k in range(-MAX_LAG, MAX_LAG + 1):
        xs: List[float] = []
        ys: List[float] = []
        for m in base_months:
            # We want proxy_index[t] paired with brent_return[t+k]
            # Find the month that is k positions ahead of m
            t = month_idx[m]
            t_plus_k = t + k
            if t_plus_k < 0 or t_plus_k >= len(base_months):
                continue
            m_plus_k = base_months[t_plus_k]
            if m_plus_k not in brent_return_by_month:
                continue
            xs.append(proxy_by_month[m])
            ys.append(brent_return_by_month[m_plus_k])

        n_k = len(xs)
        r_k = _pearson(xs, ys)
        ci95_k = 1.96 / math.sqrt(n_k) if n_k >= 4 else None
        sig = (r_k is not None and ci95_k is not None and abs(r_k) > ci95_k)

        lags.append({
            "lag_months": k,
            "r": round(r_k, 4) if r_k is not None else None,
            "n": n_k,
            "significant": sig,
        })

    # ── Peak lag ──────────────────────────────────────────────────────────────
    peak_entry: Optional[Dict[str, Any]] = None
    for entry in lags:
        r = entry["r"]
        if r is None:
            continue
        if peak_entry is None or abs(r) > abs(peak_entry["r"]):
            peak_entry = entry

    # ── CI at peak n ──────────────────────────────────────────────────────────
    peak_n = peak_entry["n"] if peak_entry else (lags[MAX_LAG]["n"] if lags else 0)
    ci95_at_peak = round(1.96 / math.sqrt(peak_n), 4) if peak_n >= 4 else None

    # ── Span ──────────────────────────────────────────────────────────────────
    span = {"start": base_months[0], "end": base_months[-1]} if base_months else None

    # ── Plain-language interpretation ─────────────────────────────────────────
    n_total = len(base_months)
    if peak_entry and peak_entry["r"] is not None:
        pk = peak_entry["lag_months"]
        pr = peak_entry["r"]
        sig_word = "significant" if peak_entry["significant"] else "NOT significant"
        if pk == 0:
            lead_desc = "contemporaneous (lag 0)"
        elif pk > 0:
            lead_desc = f"lag +{pk} months (risk proxy LEADS Brent returns)"
        else:
            lead_desc = f"lag {pk} months (Brent returns LEAD the risk proxy)"
        interpretation = (
            f"GPR/OVX-based risk proxy shows strongest correlation with monthly Brent log-returns "
            f"at {lead_desc}: r={pr:.3f}, {sig_word} at 95% (n={peak_entry['n']} pairs, "
            f"CI ±{ci95_at_peak:.3f}). Based on {n_total} months of overlapping data "
            f"({span['start']} – {span['end']}). "
            f"Contemporaneous risk-vs-Brent-level r={contemp_level_r:.3f} (levels, not returns)."
            if contemp_level_r is not None else
            f"GPR/OVX-based risk proxy shows strongest correlation with monthly Brent log-returns "
            f"at {lead_desc}: r={pr:.3f}, {sig_word} at 95% (n={peak_entry['n']} pairs, "
            f"CI ±{ci95_at_peak:.3f}). Based on {n_total} months "
            f"({span['start']} – {span['end']})."
        )
    else:
        interpretation = f"Lead-lag computed over {n_total} months but no significant peak identified."

    peak_out: Optional[Dict[str, Any]] = None
    if peak_entry:
        peak_out = {
            "lag_months": peak_entry["lag_months"],
            "r": peak_entry["r"],
            "significant": peak_entry["significant"],
        }

    result = {
        "lags": lags,
        "peak": peak_out,
        "contemporaneous_level_r": contemp_level_r,
        "n": n_total,
        "span": span,
        "ci95": ci95_at_peak,
        "interpretation": interpretation,
        "methodology": base["methodology"],
        "disclaimer": f"Monthly GPR+OVX proxy (NOT the live composite); correlation≠causation; n≈{n_total} months.",
        "source": base["source"],
        "updated_at": updated_at,
    }

    _CACHE = (result, now)
    return result


if __name__ == "__main__":
    import asyncio
    d = asyncio.run(get_leadlag())
    print("n", d.get("n"), "span", d.get("span"), "peak", d.get("peak"), "contemp", d.get("contemporaneous_level_r"))
    for lag in d.get("lags", []):
        print(" lag", lag["lag_months"], "r", round(lag["r"], 3) if lag["r"] is not None else None, "sig", lag["significant"])
