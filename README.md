# Prahari

Privileged-access **insider-threat detection platform** for banks — FinSpark'26
(Bank of Maharashtra), Problem Statement 1.

Watches privileged users, scores their behaviour in real time (rules + UEBA),
responds adaptively (step-up MFA / block), and protects its credentials and
audit log with post-quantum cryptography (ML-KEM-768 / ML-DSA-65).

## Quick start

```powershell
.\run.ps1            # Windows PowerShell  (or ./run.sh in Git Bash / Linux)
# then open http://127.0.0.1:8000  — the SOC dashboard
```

One command: venv + deps + seeded DB + dashboard + API. `-Reset` (or
`--reset`) wipes the DB for a clean demo state. See `DEMO_SCRIPT.md` for the
full 5-minute demo narration. Docker alternative: `docker compose up --build`

## Layout

- `app/` — FastAPI backend (api, models, detection, security, simulator)
- `frontend/` — React SOC dashboard (Phase 5)
- `tests/` — pytest suite

## Status

- [x] Phase 0 — scaffold, `/health`
- [x] Phase 1 — data model + normal-day simulator
- [x] Phase 2 — rules + UEBA + risk scoring
- [x] Phase 3 — attack scenario + adaptive response + WebSocket
- [x] Phase 4 — PQC vault + signed audit chain (liboqs: ML-KEM-768 + ML-DSA-65)
- [x] Phase 5 — SOC dashboard (React + Vite + Tailwind + Recharts)
- [x] Phase 6 — demo hardening (one-command offline start, DEMO_SCRIPT.md)
