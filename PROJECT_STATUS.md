# Prahari — Project Status & Team Brief

**Last updated:** 4 July 2026 · **Progress: Phases 0–3 of 6 complete** (backend detection engine fully working)

---

## 1. What we are building

**Prahari** is a privileged-access **insider-threat detection platform** for banks, built for
**FinSpark'26** (Bank of Maharashtra banking cybersecurity hackathon), Problem Statement 1:
*"Privileged Access Misuse & Insider Threat Detection."*

**One line:** catch a malicious insider in real time, respond automatically, and keep the proof quantum-safe.

It watches privileged users (DBAs, sysadmins, contractors), scores how risky their behaviour is
in real time (0–100), and responds automatically — step-up MFA, maker-checker approval, or an
outright block — while protecting its own credentials and audit log with **post-quantum cryptography**.

### The six judged outcomes
1. Detect misuse of privileged accounts ✅ *(done)*
2. Identify insider threats in real time ✅ *(done)*
3. AI-driven behavioural analysis ✅ *(done)*
4. Risk-based access control ✅ *(done)*
5. Protect critical administrative systems ✅ *(done)*
6. Quantum-proof cryptography for credentials + audit log ⏳ *(Phase 4 — next)*

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Backend | Python 3.14, FastAPI + Uvicorn |
| Database | SQLite via SQLAlchemy ORM (Postgres-swappable for the scalability story) |
| ML / UEBA | scikit-learn IsolationForest |
| Live updates | FastAPI WebSocket (`/ws/feed`) |
| PQC (Phase 4) | ML-KEM-768 + ML-DSA-65 via liboqs-python or quantcrypt |
| Frontend (Phase 5) | React + Vite + Tailwind + Recharts |
| Packaging | Docker + docker-compose, `run.sh` one-command start, fully offline |

---

## 3. Architecture

```
Privileged activity (simulated) ─▶ Collection & normalization (Event/Session models)
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                  ▼
             UEBA (IsolationForest              Rule engine (5 known-bad
             + peer comparison)                 patterns with weights)
                       └────────────────┬────────────────┘
                                        ▼
                          Risk scoring engine (one 0–100 score + "why")
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                  ▼
             Adaptive access control              SOC dashboard (Phase 5)
             MFA / maker-checker / BLOCK          fed by WebSocket
                                        │
                          PQC layer (Phase 4): ML-KEM vault
                          + ML-DSA signed, hash-chained audit log
```

---

## 4. What is DONE (Phases 0–3)

### Phase 0 — Scaffold
FastAPI app boots, `GET /health` works, venv + Docker + `run.sh` in place, pytest wired up.

### Phase 1 — Data model + simulator
- **6 ORM entities:** `User`, `Session`, `Event`, `Alert`, `AuditLogEntry`, `VaultItem`
  (last two ready for the PQC phase).
- **7 simulated privileged users:** 2 DBAs, 2 sysadmins, 1 network admin, 1 app admin, and
  **`ext_dsouza`** — a *dormant vendor contractor* who plays the attacker in the demo.
- **Normal-day simulator:** weekday business-hours sessions, consistent per-user IP/geo/device,
  routine DB queries (1–200 records), file access, occasional config changes. Deterministic (seeded RNG).
- **Seed command:** `python -m app.simulator.seed --fresh --days 14` → 7 users, ~666 events, ~90 sessions.

### Phase 2 — Detection + risk scoring
- **Rule engine** (`app/detection/rules.py`) — 5 rules with weights:
  dormant-account reactivation (30), privilege escalation (25), after-hours access 00:00–06:00 (20),
  mass export ≥1000 records (30), access outside role's resources (15).
- **UEBA** (`app/detection/ueba.py`) — per-session 7-feature vector (login hour, event count,
  records touched, resource spread, config changes, off-network IP, new device); IsolationForest
  trained on the normal history; anomaly normalized to 0–100; plus same-role **peer comparison**.
- **Risk scorer** (`app/detection/score.py`) — rules (capped 65 pts) + UEBA (up to 35 pts)
  + peer bonus (10 pts), clamped to 100, with a full human-readable reason breakdown.
- Normal sessions score ~5–25. The attack scores **100**.

### Phase 3 — Attack scenario + adaptive response + live feed
- **`trigger_attack()`** — one call: at 02:00 the dormant vendor logs in from an unknown VPN IP,
  escalates privilege on `core-banking-db`, bulk-exports 5000 customer records.
- **Adaptive access control** (`app/detection/response.py`):
  score ≥85 → **BLOCK** · ≥70 → **MAKER_CHECKER** · ≥40 → **STEP_UP_MFA** · else ALLOW.
  Every non-ALLOW decision persists a severity-tagged Alert.
- **WebSocket live feed** (`/ws/feed`) — pushes `score` and `alert` JSON frames to any
  connected dashboard the moment detection happens.
- **Verified live:** `POST /demo/attack` → score 100/100, action BLOCK, CRITICAL alert with 7
  plain-English reasons, streamed over the WebSocket in real time.

**Test suite: 11/11 passing** — covers simulator realism, every rule, normal-vs-attack scoring,
response thresholds, and the full attack-over-WebSocket loop.

---

## 5. API surface (current)

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /users` | list privileged users |
| `GET /sessions/{id}/score` | risk-score any session with reasons |
| `GET /alerts` | recent alerts |
| `POST /demo/attack` | trigger the insider-attack demo |
| `WS /ws/feed` | live score/alert stream |

---

## 6. How to run it yourself

```bash
git clone <repo>  &&  cd PRAHARI
./run.sh                                   # creates venv, installs, starts API on :8000
# in another terminal:
.venv/Scripts/python -m app.simulator.seed --fresh   # seed 14 days of normal history
curl -X POST http://127.0.0.1:8000/demo/attack        # watch the insider get caught
```

Run tests: `.venv/Scripts/python -m pytest`

---

## 7. What's NEXT

| Phase | Content | Status |
|---|---|---|
| **4** | PQC layer: ML-KEM-768 credential vault, ML-DSA-65 signed + hash-chained audit log, live tamper-detection demo | **next up** |
| 5 | React SOC dashboard: risk gauge, alert feed, timeline, heatmap, "why flagged" panel, Trigger-Attack + Tamper buttons | pending |
| 6 | Demo hardening: one-command offline start, `DEMO_SCRIPT.md` click-by-click narration, recorded fallback | pending |
| 7 | *(optional)* correlate a privileged change with a downstream suspicious transaction | stretch |

### Judging weights we're building against
Business relevance 40% · Security 30% · Uniqueness 15% · UX 5% · Scalability 5% · Ease 5%
→ priority is **detection correctness + working PQC**, clean but simple UI.

---

## 8. Repo map

```
app/
  api/routes.py        REST + WebSocket endpoints
  api/ws.py            WebSocket broadcast manager
  detection/rules.py   rule engine (5 rules)
  detection/ueba.py    IsolationForest + peer baseline
  detection/score.py   combined 0-100 risk score
  detection/response.py adaptive access control
  models/entities.py   all 6 ORM entities
  simulator/normal.py  normal-day generator
  simulator/attack.py  the 2 AM insider attack
  simulator/seed.py    CLI seeder
tests/                 11 tests, all passing
frontend/              (Phase 5)
run.sh, Dockerfile, docker-compose.yml
```

Commits are one-per-phase on `master`.
