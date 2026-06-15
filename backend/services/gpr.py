"""Caldara-Iacoviello Geopolitical Risk (GPR) Index client.

Monthly index; historical mean ~100 (baseline). Free, CC-BY.
Source: https://www.matteoiacoviello.com/gpr.htm
"""
from __future__ import annotations

import io
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
import pandas as pd

logger = logging.getLogger(__name__)

_GPR_URL = "https://www.matteoiacoviello.com/gpr_files/data_gpr_export.xls"
_CACHE_TTL = 6 * 3600  # 6 hours — monthly data, no need to hammer

_cache: Optional[tuple] = None  # (data_dict, fetched_at)


def _normalize(gpr: float) -> float:
    """Map GPR value to 0-100 risk scale.

    Formula: clamp((gpr - 50) / 2.5, 0, 100)
    Rationale:
      ~50  → 0   (very calm)
      ~100 → 20  (long-run average = moderate, not peak risk)
      ~200 → 60  (clearly elevated)
      ~300 → 100 (extreme; Ukraine invasion, 9/11 territory)
    """
    raw = (gpr - 50) / 2.5
    return float(max(0.0, min(100.0, raw)))


def _regime(gpr: float) -> str:
    if gpr < 100:
        return "normal"
    elif gpr < 150:
        return "elevated"
    elif gpr < 250:
        return "high"
    else:
        return "severe"


async def get_gpr() -> Dict[str, Any]:
    """Fetch and return the latest GPR index data.

    Returns a dict with keys:
      latest, normalized_0_100, regime, history, baseline, source, updated_at
    On any failure: same shape with Nones + error key; serves stale cache if available.
    """
    global _cache

    now = time.time()

    # Serve from cache if fresh
    if _cache is not None:
        data, ts = _cache
        if now - ts < _CACHE_TTL:
            return data

    source = "Caldara-Iacoviello Geopolitical Risk Index (monthly)"
    updated_at = datetime.utcnow().isoformat() + "Z"

    def _error_response(msg: str) -> Dict[str, Any]:
        base = {
            "latest": None,
            "normalized_0_100": None,
            "regime": "unknown",
            "history": [],
            "baseline": 100,
            "source": source,
            "updated_at": updated_at,
            "error": msg,
        }
        # Serve stale cache if we have it
        if _cache is not None:
            stale, _ = _cache
            stale_copy = dict(stale)
            stale_copy["error"] = msg
            stale_copy["updated_at"] = updated_at
            stale_copy["_stale"] = True
            return stale_copy
        return base

    # Fetch with retries
    content: Optional[bytes] = None
    last_err = ""
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                resp = await client.get(_GPR_URL)
                resp.raise_for_status()
                content = resp.content
                break
        except Exception as e:
            last_err = str(e)
            logger.warning("GPR fetch attempt %d failed: %s", attempt + 1, e)

    if content is None:
        logger.error("GPR: all fetch attempts failed: %s", last_err)
        return _error_response(f"fetch failed: {last_err}")

    # Parse Excel
    try:
        df = pd.read_excel(io.BytesIO(content), engine="xlrd")
    except Exception as e:
        logger.error("GPR: Excel parse failed: %s", e)
        return _error_response(f"parse failed: {e}")

    # Normalise column names (strip whitespace, lowercase for lookup)
    df.columns = [str(c).strip() for c in df.columns]
    col_map: Dict[str, str] = {}
    for c in df.columns:
        lc = c.lower()
        if lc == "month":
            col_map["month"] = c
        elif lc == "gpr" and "gpr" not in col_map:
            col_map["gpr"] = c
        elif lc == "gprt":
            col_map["gprt"] = c
        elif lc == "gpra":
            col_map["gpra"] = c

    if "month" not in col_map or "gpr" not in col_map:
        msg = f"expected columns not found; got: {list(df.columns)}"
        logger.error("GPR: %s", msg)
        return _error_response(msg)

    # Coerce month to datetime
    try:
        df["_month"] = pd.to_datetime(df[col_map["month"]], errors="coerce")
    except Exception as e:
        return _error_response(f"date parse failed: {e}")

    df["_gpr"] = pd.to_numeric(df[col_map["gpr"]], errors="coerce")

    # Drop rows where GPR is null
    df_valid = df.dropna(subset=["_month", "_gpr"]).copy()
    df_valid = df_valid.sort_values("_month")

    if df_valid.empty:
        return _error_response("no valid GPR rows after cleaning")

    # Latest row
    latest_row = df_valid.iloc[-1]
    latest_month = latest_row["_month"]
    latest_gpr = float(latest_row["_gpr"])

    gprt_val: Optional[float] = None
    gpra_val: Optional[float] = None
    if "gprt" in col_map:
        v = pd.to_numeric(latest_row.get(col_map["gprt"], None), errors="coerce")
        gprt_val = float(v) if pd.notna(v) else None
    if "gpra" in col_map:
        v = pd.to_numeric(latest_row.get(col_map["gpra"], None), errors="coerce")
        gpra_val = float(v) if pd.notna(v) else None

    latest = {
        "month": latest_month.strftime("%Y-%m-%d"),
        "gpr": round(latest_gpr, 2),
        "gpr_threats": round(gprt_val, 2) if gprt_val is not None else None,
        "gpr_acts": round(gpra_val, 2) if gpra_val is not None else None,
    }

    # History — last 120 months
    hist_df = df_valid.tail(120)
    history: List[Dict[str, Any]] = [
        {"month": row["_month"].strftime("%Y-%m-%d"), "gpr": round(float(row["_gpr"]), 2)}
        for _, row in hist_df.iterrows()
    ]

    norm = round(_normalize(latest_gpr), 2)
    regime = _regime(latest_gpr)

    result: Dict[str, Any] = {
        "latest": latest,
        "normalized_0_100": norm,
        "regime": regime,
        "history": history,
        "baseline": 100,
        "source": source,
        "updated_at": updated_at,
    }

    _cache = (result, now)
    return result
