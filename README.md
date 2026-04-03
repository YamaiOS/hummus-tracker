# Hummus Tracker — Strategic Maritime Intelligence

Hummus Tracker is a high-fidelity, real-time AIS vessel tracking and economic fallout modeling platform focused on the **Strait of Hormuz**. It transforms raw maritime data into actionable intelligence for geopolitical and supply chain decision-making.

## Key Features

-   **Strategic Live Map**: Real-time vessel positions with visual **Shipping Lane Corridors** (Inbound/Outbound) and pulsing **Geographical Risk Markers** for disruption events.
-   **Freight Charge Modeling**: Heuristic modeling of **Worldscale (WS) points** and **Time Charter Equivalent (TCE)** day rates for VLCC, Suezmax, and Aframax tankers.
-   **Economic Friction Analysis**: Real-time monitoring of **War Risk Insurance Multipliers** and global economic loss estimates.
-   **Oil Flow Engine (MBPD)**: Precise calculation of Million Barrels Per Day throughput using unique vessel deduplication and draught-based cargo heuristics.
-   **Selective Transit Intelligence**: Analysis of transit volume by **Vessel Flag** to identify geopolitical permitting patterns or blockades.
-   **Disruption Timeline**: Categorized intelligence feed (Security, Geopolitical, Operational) correlated with Brent Spot prices.

## Architecture

-   **Backend**: Python / FastAPI
    -   Real-time WebSocket pipeline with automated **Mock Fallback** for 100% uptime.
    -   Data integration: FRED (Oil Prices), EIA (Baselines), IMF PortWatch (Satellite AIS).
    -   Background task scheduling for daily data aggregation and correlation.
-   **Frontend**: React / TypeScript / Vite
    -   High-density dashboard with Tailwind CSS.
    -   Geographic visualization via Leaflet.
    -   Real-time state management with React Query.

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- API Keys (see `.env.example`): `AISSTREAM_API_KEY`, `FRED_API_KEY`, `EIA_API_KEY`.

### Installation & Run
1. **Backend**: `pip install -r requirements.txt` -> `PYTHONPATH=. uvicorn backend.main:app --port 8888`
2. **Frontend**: `npm install` -> `npm run dev`

---
*For a detailed history of technical implementations and logic fixes, see **[WORK_LOG.md](./WORK_LOG.md)**.*
