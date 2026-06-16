"""Syndication / distribution surfaces for Hummus Tracker.

Two pure, fully-defensive functions that turn the static snapshot JSON files
(under a given directory) into *shareable* artefacts:

  * ``build_rss``           — a valid RSS 2.0 feed (risk index + brief + incidents)
  * ``build_risk_card_svg`` — a 1200x630 OG/social card SVG of the Hormuz Risk

Neither function ever raises: a missing/garbage/empty snapshot file degrades to
a minimal-but-valid document. The web layer wires these into routes; this module
imports nothing from the app beyond ``SNAPSHOT_DIR`` (used only by the smoke).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from email.utils import format_datetime, parsedate_to_datetime
from pathlib import Path
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
SITE_URL = "https://oil.yieldwise.my"
FEED_TITLE = "Hummus Tracker — Strait of Hormuz Intelligence"
FEED_DESCRIPTION = (
    "Daily Strait of Hormuz risk index, intelligence briefs and press-reported "
    "maritime incidents — from Hummus Tracker."
)

# Level → display colour for the social card (dark petro palette).
_LEVEL_COLOUR = {
    "low": "#00a19c",       # teal
    "elevated": "#c4a35a",  # gold
    "high": "#f59e0b",      # orange
    "severe": "#ef4444",    # red
}


# ─────────────────────────────────────────────────────────────────────────────
# Low-level helpers (all defensive)
# ─────────────────────────────────────────────────────────────────────────────
def _load(snapshot_dir: Path, name: str) -> Any:
    """Read+parse a snapshot JSON file. Returns ``None`` on any problem."""
    try:
        path = Path(snapshot_dir) / name
        if not path.is_file():
            return None
        text = path.read_text(encoding="utf-8")
        if not text.strip():
            return None
        return json.loads(text)
    except Exception:
        return None


def _esc(value: Any) -> str:
    """XML-escape arbitrary content for use in element text or attributes."""
    s = "" if value is None else str(value)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _rfc822(value: Any) -> str:
    """Best-effort convert an ISO/RFC822 timestamp to an RFC822 string.

    Falls back to 'now' when the value is missing or unparseable.
    """
    dt: datetime | None = None
    if isinstance(value, str) and value.strip():
        raw = value.strip()
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            try:
                dt = parsedate_to_datetime(raw)
            except Exception:
                dt = None
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    try:
        return format_datetime(dt)
    except Exception:
        return format_datetime(datetime.now(timezone.utc))


def _meta_time(snapshot_dir: Path) -> str:
    """generated_at from _meta.json, or current UTC ISO."""
    meta = _load(snapshot_dir, "_meta.json")
    if isinstance(meta, dict):
        gen = meta.get("generated_at")
        if isinstance(gen, str) and gen.strip():
            return gen
    return datetime.now(timezone.utc).isoformat()


def _truncate(text: str, limit: int = 600) -> str:
    text = text or ""
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _risk(snapshot_dir: Path) -> dict:
    """Return a normalized risk-index dict, always with safe defaults."""
    data = _load(snapshot_dir, "risk-index.json")
    if not isinstance(data, dict):
        data = {}
    score = data.get("score")
    try:
        score = int(round(float(score)))
    except (TypeError, ValueError):
        score = None
    level = data.get("level")
    if not isinstance(level, str) or not level.strip():
        level = "unknown"
    summary = data.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        summary = "Strait of Hormuz risk index currently unavailable."
    components = data.get("components")
    if not isinstance(components, list):
        components = []
    computed_at = data.get("computed_at")
    return {
        "score": score,
        "level": level,
        "summary": summary,
        "components": components,
        "computed_at": computed_at,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. RSS 2.0 feed
# ─────────────────────────────────────────────────────────────────────────────
def build_rss(snapshot_dir: Path) -> str:
    """Build a valid RSS 2.0 feed string from the snapshot directory.

    Items (newest first): current Hormuz Risk Index, latest daily brief, and up
    to 5 recent maritime incidents. Never raises.
    """
    snapshot_dir = Path(snapshot_dir)
    build_dt = _rfc822(_meta_time(snapshot_dir))
    items: list[str] = []

    # ── Item: current risk index ─────────────────────────────────────────────
    try:
        risk = _risk(snapshot_dir)
        score_txt = f"{risk['score']}" if risk["score"] is not None else "n/a"
        level_txt = (risk["level"] or "unknown").upper()
        title = f"Hormuz Risk: {score_txt}/100 ({level_txt})"

        comp_lines = []
        for c in risk["components"][:5]:
            if not isinstance(c, dict):
                continue
            name = c.get("name") or "component"
            cs = c.get("score_0_100")
            detail = c.get("detail") or ""
            comp_lines.append(f"{name}: {cs} — {detail}".strip(" —"))
        desc_parts = [risk["summary"]]
        if comp_lines:
            desc_parts.append("Top components — " + "; ".join(comp_lines))
        description = " | ".join(p for p in desc_parts if p)

        pub = _rfc822(risk.get("computed_at") or _meta_time(snapshot_dir))
        items.append(_rss_item(
            title=title,
            link=f"{SITE_URL}/?ref=rss#risk",
            description=description,
            pub_date=pub,
            guid=f"{SITE_URL}/risk/{score_txt}/{pub}",
        ))
    except Exception:
        pass

    # ── Item: latest daily brief ──────────────────────────────────────────────
    try:
        brief = _load(snapshot_dir, "brief__latest.json")
        if isinstance(brief, dict):
            date = brief.get("date") or ""
            content = brief.get("content_markdown") or ""
            if isinstance(content, str) and content.strip():
                title = f"Hormuz Intelligence Brief — {date}".strip(" —")
                pub = _rfc822(brief.get("created_at") or date or _meta_time(snapshot_dir))
                items.append(_rss_item(
                    title=title or "Hormuz Intelligence Brief",
                    link=f"{SITE_URL}/?ref=rss#brief",
                    description=_truncate(content, 1200),
                    pub_date=pub,
                    guid=f"{SITE_URL}/brief/{date or pub}",
                ))
    except Exception:
        pass

    # ── Items: recent incidents (up to 5) ─────────────────────────────────────
    try:
        inc_data = _load(snapshot_dir, "incidents.json")
        if isinstance(inc_data, dict):
            incidents = inc_data.get("incidents") or inc_data.get("items") or []
        elif isinstance(inc_data, list):
            incidents = inc_data
        else:
            incidents = []
        for inc in incidents[:5]:
            if not isinstance(inc, dict):
                continue
            i_title = inc.get("title") or inc.get("description") or "Maritime incident"
            severity = (inc.get("severity") or "").upper()
            source = inc.get("source") or ""
            url = inc.get("url") or f"{SITE_URL}/?ref=rss#incidents"
            when = inc.get("date") or inc.get("published") or _meta_time(snapshot_dir)
            full_title = i_title
            if severity:
                full_title = f"[{severity}] {i_title}"
            desc_bits = [b for b in (severity, source) if b]
            description = " — ".join(desc_bits) or i_title
            items.append(_rss_item(
                title=full_title,
                link=str(url),
                description=description,
                pub_date=_rfc822(when),
                guid=str(url),
            ))
    except Exception:
        pass

    channel = (
        "  <channel>\n"
        f"    <title>{_esc(FEED_TITLE)}</title>\n"
        f"    <link>{_esc(SITE_URL)}</link>\n"
        f"    <description>{_esc(FEED_DESCRIPTION)}</description>\n"
        "    <language>en-us</language>\n"
        f"    <lastBuildDate>{_esc(build_dt)}</lastBuildDate>\n"
        f"    <generator>Hummus Tracker</generator>\n"
        f"{''.join(items)}"
        "  </channel>\n"
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0">\n'
        f"{channel}"
        "</rss>\n"
    )


def _rss_item(*, title: str, link: str, description: str, pub_date: str, guid: str) -> str:
    return (
        "    <item>\n"
        f"      <title>{_esc(title)}</title>\n"
        f"      <link>{_esc(link)}</link>\n"
        f"      <description>{_esc(description)}</description>\n"
        f"      <pubDate>{_esc(pub_date)}</pubDate>\n"
        f"      <guid isPermaLink=\"false\">{_esc(guid)}</guid>\n"
        "    </item>\n"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 2. Risk card SVG (1200x630 OG / social card)
# ─────────────────────────────────────────────────────────────────────────────
def build_risk_card_svg(snapshot_dir: Path) -> str:
    """Build a self-contained 1200x630 social-card SVG of the Hormuz Risk.

    Pulls from ``risk-index.json``; degrades gracefully when absent. Uses only
    system fonts and inline shapes — no external fonts/images. Never raises.
    """
    snapshot_dir = Path(snapshot_dir)
    try:
        risk = _risk(snapshot_dir)
    except Exception:
        risk = {"score": None, "level": "unknown", "summary": "", "components": [], "computed_at": None}

    score_txt = f"{risk['score']}" if risk["score"] is not None else "—"
    level = (risk["level"] or "unknown")
    level_word = level.upper()
    level_colour = _LEVEL_COLOUR.get(level.lower(), "#c4a35a")

    # One-line driver: prefer the summary, else the top component detail.
    driver = risk["summary"] or ""
    if not driver:
        comps = risk["components"]
        if comps and isinstance(comps[0], dict):
            driver = comps[0].get("detail") or comps[0].get("name") or ""
    driver = _truncate(driver, 110)

    as_of = _format_as_of(risk.get("computed_at") or _meta_time(snapshot_dir))

    font = (
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,"
        "sans-serif"
    )

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Hormuz Risk {_esc(score_txt)} {_esc(level_word)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a1626"/>
      <stop offset="1" stop-color="#0d2240"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="14" height="630" fill="{_esc(level_colour)}"/>
  <rect x="60" y="56" width="1080" height="2" fill="#1c3454"/>

  <text x="60" y="120" font-family="{font}" font-size="34" font-weight="700" letter-spacing="6" fill="#00a19c">HORMUZ RISK</text>
  <text x="60" y="150" font-family="{font}" font-size="20" font-weight="500" letter-spacing="2" fill="#7d93b2">STRAIT OF HORMUZ INTELLIGENCE</text>

  <text x="60" y="430" font-family="{font}" font-size="300" font-weight="800" fill="#f4f7fb">{_esc(score_txt)}</text>
  <text x="60" y="430" font-family="{font}" font-size="300" font-weight="800" fill="#f4f7fb"><tspan dx="6" font-size="60" fill="#7d93b2">/100</tspan></text>

  <rect x="760" y="240" width="380" height="86" rx="10" fill="{_esc(level_colour)}" opacity="0.16"/>
  <text x="950" y="298" font-family="{font}" font-size="58" font-weight="800" letter-spacing="3" text-anchor="middle" fill="{_esc(level_colour)}">{_esc(level_word)}</text>

  <text x="60" y="510" font-family="{font}" font-size="30" font-weight="500" fill="#c8d6ea">{_esc(driver)}</text>

  <text x="60" y="568" font-family="{font}" font-size="22" font-weight="400" fill="#7d93b2">as of {_esc(as_of)}</text>
  <text x="1140" y="568" font-family="{font}" font-size="26" font-weight="700" letter-spacing="1" text-anchor="end" fill="#c4a35a">oil.yieldwise.my</text>
</svg>
"""


def _format_as_of(value: Any) -> str:
    """Human 'YYYY-MM-DD HH:MM UTC' for the card; safe fallback to now."""
    dt: datetime | None = None
    if isinstance(value, str) and value.strip():
        try:
            dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except Exception:
            try:
                dt = parsedate_to_datetime(value.strip())
            except Exception:
                dt = None
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


# ─────────────────────────────────────────────────────────────────────────────
# Smoke test
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        from backend.snapshot import SNAPSHOT_DIR  # type: ignore
    except Exception:
        SNAPSHOT_DIR = Path("snapshots")
    _rss = build_rss(SNAPSHOT_DIR)
    _svg = build_risk_card_svg(SNAPSHOT_DIR)
    print("=== RSS (first 300) ===")
    print(_rss[:300])
    print("=== SVG (first 300) ===")
    print(_svg[:300])
