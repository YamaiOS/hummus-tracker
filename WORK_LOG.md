# Hummus Tracker — Work Log & Project Evolution

This document tracks the strategic and technical implementations performed on the Hummus Tracker project.

## Core Objective
Transform a basic AIS vessel tracker into a **Strategic Maritime Intelligence Dashboard** focusing on the Strait of Hormuz, providing actionable data for economic and geopolitical decision-making.

---

## Technical Implementations Summary

### 1. Data Infrastructure & Stability (QA/QC)
- **Real-time AIS Pipeline**: Implemented a WebSocket consumer for `aisstream.io` with a **30s timeout fallback**. The system now automatically switches to "Simulated Data" if the live feed is silent, ensuring the UI never hangs on "Connecting."
- **MBPD Calculation Engine**: Fixed a critical flaw in volume estimation. The system now **deduplicates vessels** within a 24h window, counting each tanker's latest cargo report only once to provide an accurate Million Barrels Per Day (MBPD) figure.
- **Geographically Aware Simulator**: Overhauled the mock generator to move vessels along realistic **Traffic Separation Schemes (TSS)**. Vessels now follow defined Inbound/Outbound shipping lanes rather than random coordinates, preventing "ships on land."
- **Database Schema (SQLite)**: Successfully evolved the schema multiple times to support:
    - `flag`: Tracking vessel nationality.
    - `latitude/longitude/category` for Disruption Events.
    - Automated re-seeding logic to ensure development environments are always up-to-date.
- **Backend Integrity**: Resolved `ImportError` and `ECONNREFUSED` states by restoring module cohesion and implementing proper background process management for the `uvicorn` server.

### 2. Strategic Intelligence Features
- **Freight Charge Modeling**: Developed a heuristic model for **Tanker Freight Rates**. It provides live estimates for **VLCC**, **Suezmax**, and **Aframax** day rates (TCE) and Worldscale (WS) points, adjusted for Brent volatility and risk premiums.
- **War Risk Insurance Monitoring**: Implemented a heuristic multiplier that tracks the financial friction of shipping. It calculates premium spikes (e.g., 13.8x baseline) based on the severity of recent regional incidents.
- **Selective Transit Analysis**: Visualized oil flow by **Vessel Flag**. This allows users to detect "geopolitical permitting" patterns (e.g., seeing if specific nations' vessels are transiting while others are blocked).
- **Alternative Route Analysis**: Integrated a **Cape of Good Hope Bypass** calculator, showing the exact time (+15 days) and cost (+$480k) penalty for avoiding the Strait.
- **Economic Loss Clock**: Added a live estimate of the daily global economic drag caused by Hormuz bottlenecks.

### 3. UI/UX & Visualization
- **Live Corridor Mapping**: Enhanced the Leaflet map with visual shipping lanes (Emerald for Outbound, Slate for Inbound) and pulsing warning markers for disruption events.
- **Vessel Telemetry Table**: Added a high-density table showing Vessel Name, Flag, Class, Destination, and Load Status.
- **Direction-Aware Routing**: Implemented logic where simulated vessels route to realistic global hubs (Singapore, Rotterdam) when outbound/loaded, and regional loading ports (Ras Tanura, Jebel Ali) when inbound/ballast.
- **Strategic Status Indicators**: Upgraded connection labels to descriptive modes ("AIS Live", "Simulated Data") with appropriate color-coding.
- **Interactive Disruption Timeline**: Redesigned the timeline to include category tags ([Security], [Operational], etc.) and sorted by newest-first for immediate relevance.

---

## Technical Audit (QC Results)
- **API Consistency**: All frontend fetch calls in `client.ts` are verified to match the `/api` prefixed routes in `backend/main.py`.
- **Test Coverage**: Core API and aggregation logic verified via `pytest`.
- **Error Handling**: Added robust try/except blocks in the AIS stream and scheduler to prevent silent crashes.
- **Performance**: Simplified unique-vessel queries to prevent SQL join bottlenecks on larger datasets.

---

## Planned / Upcoming
- **Historical Flow Trendlines**: 30/60/90 day throughput charts.
- **Strait Status Timer**: Top-level strategic alert levels (OPEN / RESTRICTED / CLOSED).
- **Satellite Data Integration**: Mocking satellite AIS vs Terrestrial AIS gaps.
