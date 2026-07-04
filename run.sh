#!/usr/bin/env bash
# Prahari one-command demo start (offline once prepped).
#   ./run.sh           start everything (seeds DB on first run)
#   ./run.sh --reset   wipe + reseed the DB first (clean demo state)
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "[prahari] creating venv..."
  python -m venv .venv
fi
if [ -f .venv/Scripts/activate ]; then
  source .venv/Scripts/activate   # Windows (Git Bash)
else
  source .venv/bin/activate        # POSIX
fi

# Install deps only if FastAPI is missing (keeps offline restarts instant).
python -c "import fastapi" 2>/dev/null || pip install -q -r requirements.txt

if [ "$1" = "--reset" ] || [ ! -f prahari.db ]; then
  echo "[prahari] seeding 14 days of baseline history..."
  python -m app.simulator.seed --fresh --days 14
fi

# Build the dashboard only if dist/ is absent (repo ships a prebuilt dist).
if [ ! -d frontend/dist ]; then
  echo "[prahari] building frontend..."
  (cd frontend && npm install --no-fund --no-audit && npm run build)
fi

echo "[prahari] SOC dashboard -> http://127.0.0.1:8000"
uvicorn app.main:app --host 127.0.0.1 --port 8000
