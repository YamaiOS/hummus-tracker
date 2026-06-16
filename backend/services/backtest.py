"""Risk Index Backtest — transparent event-study PROXY over ~2018→now.

This is an HONEST face-validity event study. It reconstructs a *proxy* of the
Hormuz Risk Index from FREE public history (Caldara-Iacoviello GPR + FRED OVX
+ Brent) and overlays known Gulf crises to show the proxy would have risen
around them. It is NOT a validated predictive model: the live index's
news/flow/AIS/insurance/weather components are NOT reconstructed here, only
the two longest-history, freely-available structural inputs.

Proxy weights are ILLUSTRATIVE: 0.55*GPR_norm + 0.45*OVX_norm.

Defensive: never raises; on any source failure returns empty series/events.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Illustrative blend weights (documented, not fitted) ──────────────────────
WEIGHTS = {"gpr": 0.55, "ovx": 0.45}

_START = "2018-01"  # proxy series start (month)

_CACHE: Optional[tuple] = None  # (result, fetched_at)
_CACHE_TTL = 24 * 3600  # 24h — monthly cadence

# ── Known Gulf crises (month, name, note) ────────────────────────────────────
# Dates align with backend/database.py disruption seeds where applicable.
_EVENTS = [
    ("2019-06", "Gulf of Oman tanker attacks",
     "Front Altair & Kokuka Courageous attacked near the Strait; limpet-mine sabotage off Fujairah weeks earlier."),
    ("2019-09", "Abqaiq-Khurais (Aramco) strike",
     "Drone/missile strike halts ~5.7 mbpd of Saudi output — largest single supply shock on record."),
    ("2020-01", "Soleimani strike",
     "US strike kills IRGC Quds commander Soleimani; Iranian retaliation fears spike oil & geopolitical risk."),
    ("2024-01", "Red Sea / Houthi escalation",
     "Houthi missile/drone attacks on Red Sea shipping reroute traffic around the Cape; Gulf risk premium rises."),
    ("2025-06", "Hormuz crisis escalation",
     "Direct Israel-Iran exchange and Hormuz closure threats; Iranian parliament endorses strait-closure motion."),
]


def _normalize_gpr(gpr: float) -> float:
    """GPR → 0-100 relative to its own multi-decade distribution.

    Same shape as the live gpr service: clamp((gpr - 50)/2.5, 0, 100).
      ~50→0, ~100(avg)→20, ~200→60, ~300(extreme)→100.
    """
    return max(0.0, min(100.0, (gpr - 50.0) / 2.5))


def _normalize_ovx(ovx: float) -> float:
    """OVX → 0-100: clamp((ovx - 15)/65*100, 0, 100).

    OVX ~15 = calm floor; ~80 = crisis-level implied crude vol.
    """
    return max(0.0, min(100.0, (ovx - 15.0) / 65.0 * 100.0))


def _level_for(v: Optional[float]) -> str:
    """Regime band for a 0-100 proxy value (matches live index thresholds)."""
    if v is None:
        return "Unknown"
    if v < 25:
        return "Low"
    if v < 50:
        return "Elevated"
    if v < 75:
        return "High"
    return "Severe"


async def _ovx_monthly(start: str) -> Dict[str, float]:
    """Month-end-keyed OVX averages from FRED OVXCLS. Returns {} on failure."""
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
        logger.warning("backtest: OVX monthly failed: %s", exc)
        return {}


async def _brent_monthly(start: str) -> Dict[str, float]:
    """Month-end-keyed Brent averages from FRED DCOILBRENTEU. Returns {} on failure."""
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
        logger.warning("backtest: Brent monthly failed: %s", exc)
        return {}


async def _gpr_monthly(start: str) -> Dict[str, float]:
    """Month-keyed GPR values from the gpr service history. Returns {} on failure."""
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
        logger.warning("backtest: GPR monthly failed: %s", exc)
        return {}


_DISCLAIMER = (
    "Illustrative event study — proxied from public GPR+OVX history; "
    "news/flow components NOT reconstructed; face validity only, "
    "not statistical validation."
)
_METHODOLOGY = (
    "Monthly proxy index over 2018→now from two free long-history inputs: "
    "Caldara-Iacoviello GPR (normalized clamp((gpr-50)/2.5)) and FRED OVX "
    "(normalized clamp((ovx-15)/65*100)), averaged to month. "
    "proxy_index = 0.55*GPR_norm + 0.45*OVX_norm (illustrative weights, not fitted). "
    "Known Gulf crises overlaid as event markers. The live Hormuz Risk Index "
    "adds news, strait-flow, insurance, weather, seismic and AIS-anomaly "
    "components that are NOT reconstructed here."
)


async def get_index_backtest() -> dict:
    """Build the monthly proxy index event-study. Never raises."""
    global _CACHE
    now = time.time()
    if _CACHE is not None:
        result, ts = _CACHE
        if now - ts < _CACHE_TTL:
            return result

    updated_at = datetime.utcnow().isoformat() + "Z"
    base: Dict[str, Any] = {
        "series": [],
        "events": [],
        "weights": WEIGHTS,
        "methodology": _METHODOLOGY,
        "disclaimer": _DISCLAIMER,
        "source": "FRED OVX + Caldara-Iacoviello GPR",
        "updated_at": updated_at,
    }

    try:
        gpr = await _gpr_monthly(_START)
        ovx = await _ovx_monthly(_START)
        brent = await _brent_monthly(_START)
    except Exception as exc:
        logger.error("backtest: source gather failed: %s", exc)
        return base

    months = sorted(set(gpr) | set(ovx))
    if not months:
        logger.warning("backtest: no monthly data from any source")
        return base

    series: List[Dict[str, Any]] = []
    by_month: Dict[str, float] = {}
    for m in months:
        if m < _START:
            continue
        gn = _normalize_gpr(gpr[m]) if m in gpr else None
        on = _normalize_ovx(ovx[m]) if m in ovx else None

        # Blend over available components; renormalize weights to present ones.
        parts = []
        if gn is not None:
            parts.append((gn, WEIGHTS["gpr"]))
        if on is not None:
            parts.append((on, WEIGHTS["ovx"]))
        if not parts:
            continue
        tw = sum(w for _, w in parts)
        proxy = sum(v * w for v, w in parts) / tw

        by_month[m] = proxy
        series.append({
            "month": m,
            "proxy_index": round(proxy, 1),
            "gpr_norm": round(gn, 1) if gn is not None else None,
            "ovx_norm": round(on, 1) if on is not None else None,
            "brent": brent.get(m),
        })

    # ── Events: pick the worse of event-month vs the month just before ───────
    events: List[Dict[str, Any]] = []
    for date, name, note in _EVENTS:
        cur = by_month.get(date)
        # month just before
        try:
            y, mo = int(date[:4]), int(date[5:7])
            pmo = mo - 1 or 12
            py = y if mo > 1 else y - 1
            prev_key = f"{py:04d}-{pmo:02d}"
        except Exception:
            prev_key = None
        prev = by_month.get(prev_key) if prev_key else None

        vals = [v for v in (cur, prev) if v is not None]
        pv = max(vals) if vals else None
        events.append({
            "date": date,
            "name": name,
            "proxy_index": round(pv, 1) if pv is not None else None,
            "flagged_level": _level_for(pv),
            "note": note,
        })

    result = dict(base)
    result["series"] = series
    result["events"] = events
    _CACHE = (result, now)
    return result


if __name__ == "__main__":
    import asyncio
    d = asyncio.run(get_index_backtest())
    print("series:", len(d["series"]), "events:", len(d["events"]))
    for e in d["events"]:
        print(" ", e["date"], e["name"], "->", e["proxy_index"], e["flagged_level"])
    if d["series"]:
        print("first:", d["series"][0])
        print("last :", d["series"][-1])
