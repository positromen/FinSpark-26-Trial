# Prahari

Privileged-access **insider-threat detection platform** for banks — FinSpark'26
(Bank of Maharashtra), Problem Statement 1.

Watches privileged users, scores their behaviour in real time (rules + UEBA),
responds adaptively (step-up MFA / block), and protects its credentials and
audit log with post-quantum cryptography (ML-KEM-768 / ML-DSA-65).

## Quick start

```bash
./run.sh
# then open http://127.0.0.1:8000/health
```

Or with Docker: `docker compose up --build`

## Layout

- `app/` — FastAPI backend (api, models, detection, security, simulator)
- `frontend/` — React SOC dashboard (Phase 5)
- `tests/` — pytest suite

## Status

- [x] Phase 0 — scaffold, `/health`
- [ ] Phase 1 — data model + normal-day simulator
- [ ] Phase 2 — rules + UEBA + risk scoring
- [ ] Phase 3 — attack scenario + adaptive response + WebSocket
- [ ] Phase 4 — PQC vault + signed audit chain
- [ ] Phase 5 — SOC dashboard
- [ ] Phase 6 — demo hardening
