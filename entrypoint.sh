#!/bin/sh
# Generate an initial snapshot before serving so the dashboard is never blank,
# then hand off to the lightweight static server (which refreshes hourly).
set -e
echo "[entrypoint] Generating initial snapshot..."
python -m backend.snapshot || echo "[entrypoint] initial snapshot failed — serving will retry on schedule"
echo "[entrypoint] Starting static server..."
exec uvicorn backend.serve:app --host 0.0.0.0 --port 8080
