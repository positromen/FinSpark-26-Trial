#!/usr/bin/env bash
# One-command start for the Prahari demo (backend for now; frontend added in Phase 5).
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python -m venv .venv
fi
# Windows (Git Bash) vs POSIX venv layout
if [ -f .venv/Scripts/activate ]; then
  source .venv/Scripts/activate
else
  source .venv/bin/activate
fi

pip install -q -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
