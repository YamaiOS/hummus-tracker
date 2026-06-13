#!/bin/sh
# Start the lightweight server immediately so the machine is reachable on :8080
# right away. serve.py's lifespan kicks off the initial snapshot in the
# background (and refreshes hourly), so the dashboard returns 503 only briefly
# on a cold first boot, then fills in once the first snapshot completes.
exec uvicorn backend.serve:app --host 0.0.0.0 --port 8080
