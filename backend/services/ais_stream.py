"""AIS Stream WebSocket consumer — real-time vessel tracking via aisstream.io.

Connects to aisstream.io WebSocket, filters for tankers in the Strait of Hormuz
bounding box, and stores vessel positions in the database.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
from datetime import datetime, timezone
from typing import Dict, List, Optional

import websockets

from ..models import (
    HORMUZ_BBOX,
    VesselTransit,
    classify_vessel,
    estimate_cargo_barrels,
    infer_direction,
)
from ..database import SessionLocal
from .activity import log_activity

logger = logging.getLogger(__name__)

_API_KEY = os.getenv("AISSTREAM_API_KEY", "")

# In-memory vessel cache for live dashboard
_live_vessels: Dict[str, dict] = {}
_vessel_first_seen: Dict[str, datetime] = {} # mmsi -> first observation in bbox
_last_message_time: Optional[datetime] = None
_total_messages: int = 0
_stream_mode: str = "offline"  # offline, live, mock
_is_connected: bool = False


def get_live_vessels() -> List[dict]:
    """Return current vessels in the Hormuz area."""
    now = datetime.utcnow()
    # Only return vessels seen in last 30 minutes
    cutoff = 30 * 60
    active = []
    stale_keys = []
    for mmsi, v in _live_vessels.items():
        try:
            obs = datetime.fromisoformat(v["observed_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            if (now - obs).total_seconds() < cutoff:
                active.append(v)
            else:
                stale_keys.append(mmsi)
        except Exception:
            active.append(v)

    for k in stale_keys:
        del _live_vessels[k]
        if k in _vessel_first_seen:
            del _vessel_first_seen[k]

    # Return up to 50 vessels
    return active[:50]


def get_stream_status() -> dict:
    """Return stream health info."""
    return {
        "connected": _is_connected,
        "mode": _stream_mode,
        "last_message": _last_message_time.isoformat() if _last_message_time else None,
        "total_messages": _total_messages,
        "active_vessels": len(_live_vessels),
    }


async def _process_message(data: dict) -> None:
    """Process a single AIS message from the stream."""
    global _last_message_time, _total_messages
    _total_messages += 1
    _last_message_time = datetime.utcnow()

    msg_type = data.get("MessageType")
    if msg_type != "PositionReport":
        return

    meta = data.get("MetaData", {})
    pos = data.get("Message", {}).get("PositionReport", {})
    if not pos:
        return

    mmsi = str(meta.get("MMSI", ""))
    if not mmsi:
        return

    lat = pos.get("Latitude", 0)
    lon = pos.get("Longitude", 0)

    # Verify within bounding box
    if not (HORMUZ_BBOX["lat_min"] <= lat <= HORMUZ_BBOX["lat_max"] and
            HORMUZ_BBOX["lon_min"] <= lon <= HORMUZ_BBOX["lon_max"]):
        return

    vessel_type = meta.get("ShipType", 0)
    ship_name = meta.get("ShipName", "").strip() or None
    imo = str(meta.get("IMO", "")) if meta.get("IMO") else None
    flag = meta.get("Flag", "").strip() or None

    raw_speed = pos.get("Sog", 0)
    speed = raw_speed if raw_speed <= 30 else 0  # Cap impossible speeds (AIS data errors)
    course = pos.get("Cog", 0)
    heading = pos.get("TrueHeading")
    nav_status = str(pos.get("NavigationalStatus", ""))

    draught = meta.get("Draught", 0) / 10.0 if meta.get("Draught") else None
    max_draught = meta.get("MaxDraught", 0) / 10.0 if meta.get("MaxDraught") else None
    destination = meta.get("Destination", "").strip() or None

    dwt = _estimate_dwt_from_type(vessel_type)
    vessel_class = classify_vessel(dwt, vessel_type)
    is_loaded, estimated_barrels = estimate_cargo_barrels(dwt, draught, max_draught)
    direction = infer_direction(course, lon)
    crude_grade = _infer_crude_grade(destination, flag) if is_loaded else None

    now = datetime.utcnow()
    if mmsi not in _vessel_first_seen:
        _vessel_first_seen[mmsi] = now
    
    dwell_hrs = (now - _vessel_first_seen[mmsi]).total_seconds() / 3600
    now_iso = now.isoformat()

    # Destination change detection
    if mmsi in _live_vessels:
        old_dest = _live_vessels[mmsi].get("destination")
        if destination and old_dest and destination != old_dest:
            log_activity(
                event_type="destination_pivot",
                message=f"Pivoted: {ship_name or mmsi} changed destination from {old_dest} to {destination}",
                severity="info",
                metadata={"mmsi": mmsi, "old": old_dest, "new": destination}
            )

    vessel_data = {
        "mmsi": mmsi,
        "imo": imo,
        "name": ship_name,
        "vessel_type": vessel_type,
        "vessel_class": vessel_class,
        "dwt": dwt,
        "lat": lat,
        "lon": lon,
        "speed": speed,
        "course": course,
        "heading": heading,
        "draught": draught,
        "max_draught": max_draught,
        "destination": destination,
        "is_loaded": is_loaded,
        "estimated_barrels": estimated_barrels,
        "crude_grade": crude_grade,
        "direction": direction,
        "flag": flag,
        "observed_at": now_iso,
        "nav_status": nav_status,
        "dwell_hours": dwell_hrs,
    }

    _live_vessels[mmsi] = vessel_data

    try:
        with SessionLocal() as db:
            transit = VesselTransit(
                mmsi=mmsi,
                imo=imo,
                vessel_name=ship_name,
                vessel_type=vessel_type,
                vessel_class=vessel_class,
                dwt=dwt,
                latitude=lat,
                longitude=lon,
                speed=speed,
                course=course,
                heading=heading,
                draught=draught,
                max_draught=max_draught,
                destination=destination,
                nav_status=nav_status,
                is_loaded=is_loaded,
                estimated_barrels=estimated_barrels,
                crude_grade=crude_grade,
                direction=direction,
                flag=flag,
                observed_at=datetime.utcnow(),
            )
            db.add(transit)
            db.commit()
    except Exception as e:
        logger.warning("Failed to store transit: %s", e)


def _estimate_dwt_from_type(vessel_type: int) -> float | None:
    """Rough DWT estimate based on AIS vessel type code."""
    if vessel_type == 84: return 150_000
    if vessel_type == 80: return 100_000
    if vessel_type in (81, 82, 83): return 80_000
    if vessel_type in (85, 86, 87, 88, 89): return 50_000
    if vessel_type in range(71, 80): return 80_000
    return None


def _infer_crude_grade(destination: Optional[str], flag: Optional[str]) -> str | None:
    """Infer likely crude grade based on destination (often loading port) and flag."""
    if not destination:
        return None
    
    d = destination.upper()
    
    # Saudi Arabia
    if "RAS TANURA" in d or "JUAYMAH" in d:
        return "Arab Light/Medium"
    if "YANBU" in d:
        return "Arab Extra Light"
    
    # Iraq
    if "BASRAH" in d or "ABOT" in d or "KAAOT" in d:
        return "Basrah Medium/Heavy"
    
    # UAE
    if "DAS ISLAND" in d:
        return "Umm Shaif/Lower Zakum"
    if "JEBEL DHANNA" in d or "RUWAIS" in d:
        return "Murban"
    if "ZIRKU" in d:
        return "Upper Zakum"
    
    # Iran
    if "KHARG" in d or "KHARQ" in d:
        return "Iran Heavy/Light"
    if "SOROOSH" in d or "NOWROOZ" in d:
        return "Soroosh/Nowrooz"
    
    # Kuwait
    if "MINA AL AHMADI" in d or "SHUAIBA" in d:
        return "Kuwait Export"
    
    # Qatar
    if "HALUL" in d:
        return "Qatar Marine"
    if "MESSAIEED" in d:
        return "Qatar Land"

    return None


async def run_ais_stream() -> None:
    """Connect to aisstream.io and process vessel positions in Hormuz."""
    global _stream_mode, _is_connected
    
    if not _API_KEY or _API_KEY.startswith("example"):
        logger.warning("AISSTREAM_API_KEY not set or invalid — using mock stream")
        _stream_mode = "mock"
        await _run_mock_stream()
        return

    _stream_mode = "live"
    url = "wss://stream.aisstream.io/v0/stream"
    subscribe_msg = {
        "APIKey": _API_KEY,
        "BoundingBoxes": [
            [
                [HORMUZ_BBOX["lat_min"], HORMUZ_BBOX["lon_min"]],
                [HORMUZ_BBOX["lat_max"], HORMUZ_BBOX["lon_max"]],
            ]
        ],
        "FilterMessageTypes": ["PositionReport"],
    }

    fail_count = 0
    while True:
        try:
            logger.info("Connecting to AIS stream (Hormuz bounding box)...")
            async with websockets.connect(url, ping_interval=30) as ws:
                _is_connected = True
                await ws.send(json.dumps(subscribe_msg))
                logger.info("AIS stream connected. Listening for tanker positions...")

                fail_count = 0
                while True:
                    try:
                        raw_msg = await asyncio.wait_for(ws.recv(), timeout=30.0)
                        data = json.loads(raw_msg)
                        await _process_message(data)
                    except asyncio.TimeoutError:
                        logger.warning("AIS stream silent for 30s. Triggering fallback.")
                        raise Exception("Stream silent")
                    except Exception as e:
                        if isinstance(e, websockets.ConnectionClosed):
                            raise e
                        logger.warning("Error processing AIS message: %s", e)

        except Exception as e:
            _is_connected = False
            fail_count += 1
            logger.warning("AIS stream error: %s. Fails: %d", e, fail_count)
            
            if fail_count >= 1:
                logger.error("Live stream silent or failing. Falling back to mock data immediately.")
                _stream_mode = "mock"
                await _run_mock_stream()
                return

        await asyncio.sleep(10)


async def _run_mock_stream() -> None:
    """Fallback generator for mock vessel movements using realistic shipping lanes.
    Includes intentional anomalies (Dark Fleet and STS events) for demonstration.
    """
    global _is_connected
    
    _is_connected = True
    mmsis = [
        "241474000", "311000854", "538008272", "374633000", "232022414", "538010156", 
        "999000111", "999000222", "888000666", "999000333", "999000444", "999000555"
    ]
    names = [
        "SEA VOYAGER", "GLOBAL SPIRIT", "OCEAN AMBASSADOR", "DESERT STAR", "NORTHERN LIGHT", "GULF HORIZON", 
        "SHADOW_T1", "SHADOW_T2", "GHOST_TANKER", "STORAGE_VLCC", "FUJAIRAH_CONG", "KHOR_FAKKAN_CONG"
    ]
    flags = [
        "Greece", "Marshall Islands", "Norway", "Panama", "United Kingdom", "Marshall Islands", 
        "Unknown", "Unknown", "Unknown", "Unknown", "Unknown", "Unknown"
    ]
    
    outbound_path = [[25.2, 55.2], [25.8, 55.8], [26.4, 56.3], [26.7, 56.6], [26.3, 57.2], [25.8, 57.8]]
    inbound_path = [[25.5, 57.8], [26.5, 57.0], [27.1, 56.6], [26.8, 56.2], [26.2, 55.7], [25.0, 54.8]]

    out_dests = ["SINGAPORE", "NINGBO, CN", "ROTTERDAM, NL", "SUEZ CANAL", "ULSAN, KR", "MUMBAI, IN"]
    in_dests = ["RAS TANURA, SA", "JEBEL ALI, UAE", "MINA AL AHMADI, KW", "JUAYMAH, SA", "DAS ISLAND, UAE"]

    vessel_states = {}
    for m in mmsis:
        is_outbound = random.choice([True, False])
        vessel_states[m] = {
            "path": outbound_path if is_outbound else inbound_path,
            "progress": random.random(),
            "speed": random.uniform(0.005, 0.015),
            "dest": random.choice(out_dests if is_outbound else in_dests),
            "is_stopped": False,
            "is_dark": False,
            "last_emit": 0
        }

    # Setup STS Scenario: SHADOW_T1 and SHADOW_T2 meet near Larak Island
    vessel_states["999000111"].update({"is_stopped": True, "progress": 0.5, "is_loaded": True, "lat": 26.85, "lon": 56.35})
    vessel_states["999000222"].update({"is_stopped": True, "progress": 0.5, "is_loaded": False, "lat": 26.852, "lon": 56.352})
    
    # Setup Dark Fleet Scenario: GHOST_TANKER will stop emitting after one signal
    vessel_states["888000666"].update({"is_dark": False, "progress": 0.3})

    # Setup Floating Storage Scenario: STORAGE_VLCC is stationary and loaded
    vessel_states["999000333"].update({"is_stopped": True, "is_loaded": True, "lat": 25.50, "lon": 56.80, "dest": "FLOATING STORAGE"})

    # Setup Congestion Scenario: Vessels that drift slowly towards terminal from ~0.15 deg away
    # Fujairah is 25.12, 56.33
    vessel_states["999000444"].update({
        "path": [[25.25, 56.45], [25.12, 56.33]],
        "progress": 0.0,
        "speed": 0.01,
        "speed_kt": random.uniform(0.8, 1.5),  # slow drift for congestion detection (<2kt)
        "is_loaded": False,
        "dest": "FUJAIRAH ANCHORAGE"
    })
    # Khor Fakkan is 25.35, 56.35
    vessel_states["999000555"].update({
        "path": [[25.50, 56.50], [25.35, 56.35]],
        "progress": 0.0,
        "speed": 0.01,
        "speed_kt": random.uniform(0.5, 1.2),  # slow drift for congestion detection (<2kt)
        "is_loaded": False,
        "dest": "KHOR FAKKAN"
    })

    while True:
        mmsi = random.choice(mmsis)
        idx = mmsis.index(mmsi)
        state = vessel_states[mmsi]
        
        if state.get("is_dark"):
            await asyncio.sleep(1)
            continue

        is_loaded = state.get("is_loaded")
        if is_loaded is None:
            is_out = (state["path"] == outbound_path)
            is_loaded = is_out and not state.get("is_stopped")

        if not state.get("is_stopped"):
            state["progress"] += state["speed"]
            if state["progress"] > 1:
                state["progress"] = 0
                is_out = (state["path"] == outbound_path)
                state["dest"] = random.choice(out_dests if is_out else in_dests)

            path = state["path"]
            segment_count = len(path) - 1
            total_p = state["progress"] * segment_count
            seg_idx = int(total_p)
            seg_p = total_p - seg_idx

            if seg_idx >= segment_count:
                seg_idx = segment_count - 1
                seg_p = 1.0

            p1 = path[seg_idx]
            p2 = path[seg_idx + 1]

            lat = p1[0] + (p2[0] - p1[0]) * seg_p + random.uniform(-0.01, 0.01)
            lon = p1[1] + (p2[1] - p1[1]) * seg_p + random.uniform(-0.01, 0.01)
            # Congestion vessels drift slowly; normal vessels transit at 11-14kt
            sog = state.get("speed_kt", random.uniform(11, 14))
        else:
            lat = state["lat"]
            lon = state["lon"]
            sog = state.get("speed_kt", random.uniform(0.1, 0.5))

        is_out = (state["path"] == outbound_path)
        course = 45 if is_out else 225
        
        # Special logic for Ghost Tanker
        if mmsi == "888000666":
            state["is_dark"] = True # Only one signal, then disappears
        
        mock_data = {
            "MessageType": "PositionReport",
            "MetaData": {
                "MMSI": int(mmsi),
                "ShipName": names[idx],
                "ShipType": random.choice([84, 71, 80]),
                "Draught": 155 if is_loaded else 85,
                "MaxDraught": 160,
                "Flag": flags[idx],
                "Destination": state["dest"]
            },
            "Message": {
                "PositionReport": {
                    "Latitude": lat,
                    "Longitude": lon,
                    "Sog": sog,
                    "Cog": course + random.uniform(-5, 5),
                }
            }
        }
        
        await _process_message(mock_data)
        await asyncio.sleep(random.uniform(1, 3))

