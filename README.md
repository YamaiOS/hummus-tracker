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

The backend uses a **snapshot + static-serve** model — no always-on AIS websocket, no multi-job scheduler in the serving process.

-   **`backend/snapshot.py`** — Hourly batch job. Seeds the DB, samples the AIS stream for a bounded window (`AIS_SAMPLE_SECONDS`, default 75 s), runs all aggregation and detection jobs, evaluates threshold alerts (Shamal wind, dark vessels, low strait flow vs EIA baseline, STS transfers), then calls every frontend API endpoint in-process via ASGI and dumps the JSON responses to `snapshots/*.json`.
-   **`backend/serve.py`** — Lightweight static server. Serves `snapshots/*.json` for `/api/...` requests (query strings ignored) and the compiled SPA. Triggers the first snapshot in a background subprocess on boot, then re-runs it hourly. No live external calls at request time.
-   **`backend/main.py`** — Full FastAPI app. Still exists to define endpoint shapes; imported by `snapshot.py` for the in-process ASGI calls. No longer the serving entrypoint.
-   **Frontend**: React / TypeScript / Vite — self-hosted fonts and Leaflet CSS (no CDN), code-split lazy tabs, vessel map with heading arrows and rich click popups, `DataFreshnessBadge` showing when the last snapshot ran, global `ErrorBoundary`.

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- API Keys (see `.env.example`): `AISSTREAM_API_KEY`, `FRED_API_KEY`, `EIA_API_KEY`.

### Installation & Run
1. **Install deps**: `pip install -r requirements.txt` / `npm install`
2. **Generate a snapshot** (seeds DB, samples AIS, writes `snapshots/*.json`):
   ```
   python -m backend.snapshot
   ```
3. **Serve** (static API files + SPA, hourly snapshot auto-fires):
   ```
   PYTHONPATH=. uvicorn backend.serve:app --port 8888
   ```
4. **Frontend dev**: `npm run dev`

### Deploy (Fly.io)
App name: **hummus-tracker** — live at **https://hummus-tracker.fly.dev**

`entrypoint.sh` starts `uvicorn backend.serve:app`. `fly.toml` sets `min_machines_running = 1` and `auto_stop_machines = "suspend"` so the machine is never fully stopped — this keeps the in-process hourly scheduler firing. Region: `sin`.

---
*For a detailed history of technical implementations and logic fixes, see **[WORK_LOG.md](./WORK_LOG.md)**.*
