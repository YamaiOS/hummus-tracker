"""Realized oil volatility — computed from public-domain Brent prices (FRED/EIA).

Replaces the former CBOE OVX feed (FRED OVXCLS), which is copyrighted and
not licensed for public redisplay.  This implementation computes a self-derived
annualized realized-volatility measure:

    rvol = trailing-21-trading-day std(daily log returns of Brent) × √252 × 100

The Brent series (FRED DCOILBRENTEU) is EIA data — explicitly public domain.
"""
from __future__ import annotations

import logging
import math
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_API_KEY = os.getenv("FRED_API_KEY", "")
_BASE = "https://api.stlouisfed.org/fred/series/observations"

BRENT_SERIES = "DCOILBRENTEU"  # EIA/FRED — public domain

_cache: Dict[str, tuple] = {}  # cache_key -> (data, fetched_at)
_CACHE_TTL = 3600  # 1 hour

# Need enough history to compute:
#   21-day rvol window + 252-day mean/std + buffer for weekends/holidays
_FETCH_DAYS = 700   # ~2.7 years of calendar days ≈ ~480 trading days — ample
_HISTORY_DAYS = 180  # sparkline history entries to return


async def get_oil_volatility() -> dict:
    """Return realized oil volatility computed from Brent (FRED/EIA, public domain).

    Returns a dict with:
      - rvol: latest annualized 21-day realized volatility (float|None), in %
      - rvol_date: date of the latest rvol observation (str|None)
      - mean_252: 252-trading-day rolling mean of rvol (float|None)
      - zscore: (latest rvol - mean_252) / std_252 (float|None)
      - regime: "low" | "elevated" | "high" | "unknown"
      - history: last ~180 daily [{date, rvol}] for sparkline
      - window_days: 21 (the rvol rolling window)
      - source: attribution string
      - updated_at: ISO timestamp of this fetch
    """
    if not _API_KEY:
        logger.warning("FRED_API_KEY not set — returning empty volatility data")
        return _empty_response()

    start = (datetime.now() - timedelta(days=_FETCH_DAYS)).strftime("%Y-%m-%d")
    raw = await _fetch_series(BRENT_SERIES, start)

    if not raw:
        return _empty_response()

    # Build daily log-return series (only where consecutive prices exist)
    prices = [r["value"] for r in raw]
    dates = [r["date"] for r in raw]

    # Compute daily log returns: ln(P_t / P_{t-1})
    log_returns: List[float] = []
    ret_dates: List[str] = []
    for i in range(1, len(prices)):
        if prices[i] > 0 and prices[i - 1] > 0:
            log_returns.append(math.log(prices[i] / prices[i - 1]))
            ret_dates.append(dates[i])

    if len(log_returns) < 22:
        # Not enough data for even one 21-day window
        return _empty_response()

    # ── Compute trailing-21-day realized volatility for every day ──
    WINDOW = 21
    ANNUAL_FACTOR = math.sqrt(252) * 100.0  # annualize and convert to %

    rvol_series: List[float] = []
    rvol_dates: List[str] = []
    for i in range(WINDOW - 1, len(log_returns)):
        window_rets = log_returns[i - WINDOW + 1 : i + 1]
        mean_r = sum(window_rets) / WINDOW
        variance = sum((r - mean_r) ** 2 for r in window_rets) / (WINDOW - 1)
        std_r = math.sqrt(variance) if variance > 0 else 0.0
        rvol_series.append(std_r * ANNUAL_FACTOR)
        rvol_dates.append(ret_dates[i])

    if not rvol_series:
        return _empty_response()

    latest_rvol: Optional[float] = rvol_series[-1]
    latest_date: Optional[str] = rvol_dates[-1]

    # ── 252-trading-day mean + z-score of the latest rvol ──
    window_252 = rvol_series[-252:] if len(rvol_series) >= 252 else rvol_series
    mean_252: Optional[float] = None
    std_252: Optional[float] = None
    zscore: Optional[float] = None
    regime = "unknown"

    if len(window_252) >= 2:
        mean_252 = sum(window_252) / len(window_252)
        variance_252 = sum((x - mean_252) ** 2 for x in window_252) / len(window_252)
        std_252 = math.sqrt(variance_252) if variance_252 > 0 else 0.0

    if (
        mean_252 is not None
        and std_252 is not None
        and std_252 > 0
        and latest_rvol is not None
    ):
        zscore = (latest_rvol - mean_252) / std_252
        # Regime thresholds (slightly tighter than old OVX ones because rvol
        # distributions differ; these mirror the risk_index regime bands):
        #   z < -0.5  → low
        #   -0.5..1.0 → elevated
        #   z > 1.0   → high
        if zscore < -0.5:
            regime = "low"
        elif zscore < 1.0:
            regime = "elevated"
        else:
            regime = "high"
    elif latest_rvol is not None and mean_252 is not None:
        # std is 0 — constant series edge case; treat as low
        regime = "low"
        zscore = 0.0

    # ── Build sparkline history (last ~180 rvol observations) ──
    history_window = rvol_series[-_HISTORY_DAYS:]
    history_dates = rvol_dates[-_HISTORY_DAYS:]
    history = [
        {"date": d, "rvol": round(v, 4)}
        for d, v in zip(history_dates, history_window)
    ]

    return {
        "rvol": round(latest_rvol, 4) if latest_rvol is not None else None,
        "rvol_date": latest_date,
        "mean_252": round(mean_252, 4) if mean_252 is not None else None,
        "zscore": round(zscore, 4) if zscore is not None else None,
        "regime": regime,
        "history": history,
        "window_days": WINDOW,
        "source": "Realized volatility computed from Brent (FRED/EIA, public domain)",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


def _empty_response() -> dict:
    return {
        "rvol": None,
        "rvol_date": None,
        "mean_252": None,
        "zscore": None,
        "regime": "unknown",
        "history": [],
        "window_days": 21,
        "source": "Realized volatility computed from Brent (FRED/EIA, public domain)",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


async def _fetch_series(series_id: str, start_date: str) -> List[Dict]:
    """Fetch a FRED time series with 1h cache; returns [] on failure (never throws)."""
    cache_key = f"{series_id}:{start_date}"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    params = {
        "series_id": series_id,
        "api_key": _API_KEY,
        "file_type": "json",
        "observation_start": start_date,
        "sort_order": "asc",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(_BASE, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        logger.error("FRED fetch %s failed: %s", series_id, e)
        # Serve stale cache if available
        if cache_key in _cache:
            data, _ = _cache[cache_key]
            logger.warning("Serving stale cache for %s", series_id)
            return data
        return []

    observations = payload.get("observations", [])
    result = []
    for obs in observations:
        val = obs.get("value", ".")
        if val == ".":
            continue
        try:
            result.append({"date": obs["date"], "value": float(val)})
        except (ValueError, KeyError):
            continue

    _cache[cache_key] = (result, time.time())
    return result
