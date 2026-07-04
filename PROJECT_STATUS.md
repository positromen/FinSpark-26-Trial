# PRAHARI — Complete Project Document

**Privileged-Access Insider-Threat Detection Platform for Banks**

**Event:** FinSpark'26 — Bank of Maharashtra Banking Cybersecurity Hackathon
**Problem Statement 1:** Privileged Access Misuse & Insider Threat Detection
**Last updated:** 4 July 2026 · **Progress:** Phases 0–3 of 6 complete

---

## 1. The problem

Banks give a small set of people — database admins, system admins, network engineers,
vendor contractors — *privileged* access to core systems: the core banking database,
payment switches, firewalls. Traditional security (firewalls, antivirus, IAM) protects
against **outsiders**. It is nearly blind to a **trusted insider** who:

- reactivates a forgotten dormant/vendor account,
- quietly escalates their own privileges,
- logs in at 2 AM when nobody is watching,
- bulk-exports thousands of customer records, and
- edits the audit log to erase the evidence.

Insider incidents are among the costliest breach categories in banking, and the audit
trail itself becomes untrustworthy the moment a privileged user can touch it. On top of
that, "harvest now, decrypt later" quantum threats mean credentials and evidence encrypted
with classical crypto today may be readable in a few years.

## 2. Our solution — Prahari ("sentinel")

Prahari sits between privileged users and critical systems, and does four things:

1. **Watches** every privileged action (login, query, export, config/privilege change)
   as normalized events tied to a user session.
2. **Scores** each session's risk 0–100 in real time by combining:
   - a **rule engine** (known-bad patterns an auditor would flag), and
   - **UEBA** — machine-learned behavioural baselines per user and role
     (AI anomaly detection + peer-group comparison).
3. **Responds** automatically based on the score: allow, force step-up MFA, require
   maker-checker approval, or **block the session outright** — and raises an alert on a
   live SOC dashboard, with a plain-English explanation of *why*.
4. **Protects its own evidence** with post-quantum cryptography: privileged credentials
   sealed in an **ML-KEM-768** vault, and every audit entry **hash-chained and ML-DSA-65
   signed** so tampering is mathematically detectable — even by a future quantum attacker.

**One line:** *catch a malicious insider in real time, respond automatically, and keep
the proof quantum-safe.*

### How it maps to the six judged outcomes

| # | Required outcome | How Prahari delivers | Status |
|---|---|---|---|
| 1 | Detect misuse of privileged accounts | Rule engine: 5 weighted misuse patterns | ✅ done |
| 2 | Identify insider threats in real time | Per-session scoring + WebSocket push (< 1 s) | ✅ done |
| 3 | AI-driven behavioural analysis | IsolationForest UEBA + peer baselines | ✅ done |
| 4 | Risk-based access control | Score→action ladder: MFA / maker-checker / block | ✅ done |
| 5 | Protect critical admin systems | Blocks the session before the export completes | ✅ done |
| 6 | Quantum-proof cryptography | ML-KEM vault + ML-DSA signed audit chain | ✅ done |

### Judging weights we build against
Business relevance **40%** · Security **30%** · Uniqueness **15%** · UX 5% · Scalability 5% · Ease 5%
→ Priority: detection correctness + working PQC > fancy UI. Clean, simple dashboard.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.14 | team familiarity, fast iteration |
| API | FastAPI + Uvicorn | async, WebSocket support, auto OpenAPI docs |
| Database | SQLite via SQLAlchemy ORM | zero-friction offline demo; ORM keeps it Postgres-swappable |
| ML | scikit-learn `IsolationForest` | proven unsupervised anomaly detection, tiny footprint |
| PQC | liboqs-python or quantcrypt → **ML-KEM-768** (FIPS 203) + **ML-DSA-65** (FIPS 204) | NIST-standardized post-quantum algorithms, behind one abstraction module |
| Live feed | FastAPI WebSocket | real-time dashboard updates |
| Frontend | React + Vite + Tailwind + Recharts | fast to build, professional SOC look |
| Packaging | Docker + docker-compose + `run.sh` | one-command, fully **offline** demo (no internet at venue) |

**Constraints honoured:** no cloud dependencies, no external APIs at demo time, no secrets
in the repo, no heavyweight ML (PyTorch autoencoder is an optional stretch only).

---

## 4. Architecture

```
Privileged activity sources ─▶ Collection & normalization (Event/Session models)
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                  ▼
             Behavioural analytics (UEBA)          Rule engine
             IsolationForest + peer baseline       5 known-bad patterns
                       └────────────────┬────────────────┘
                                        ▼
                              Risk scoring engine  (one 0–100 score/session + "why")
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                  ▼
             Adaptive access control              SOC dashboard (React)
             step-up MFA / maker-checker / block  gauge, alerts, timeline, heatmap
                                        │
                              Post-quantum security layer
                              ML-KEM-768 vault + ML-DSA-65 signed audit chain
```

For the hackathon, privileged activity is produced by a built-in **simulator** (a real
bank would feed PAM/SIEM logs into the same Event model — that's the integration story).

---

## 5. Data model (6 entities — `app/models/entities.py`)

| Entity | Key fields | Purpose |
|---|---|---|
| `User` | username, name, role (DBA/SYSADMIN/NET_ADMIN/APP_ADMIN/CONTRACTOR), is_dormant, is_vendor | the privileged workforce |
| `Session` | user, started_at, ended_at, risk_score, risk_reasons | one login-to-logout window; unit of scoring |
| `Event` | user, session, action_type (LOGIN/DB_QUERY/DB_EXPORT/CONFIG_CHANGE/PRIV_CHANGE/FILE_ACCESS/LOGOUT), resource, records_touched, source_ip, geo, device, timestamp | one privileged action |
| `Alert` | user, session, severity (INFO/WARNING/CRITICAL), action_taken, message | detection output shown in SOC feed |
| `AuditLogEntry` | actor, action, payload, prev_hash, entry_hash, signature | hash-chained + PQC-signed evidence (Phase 4) |
| `VaultItem` | name, ciphertext, nonce, kem_ciphertext | PQC-wrapped privileged credential (Phase 4) |

### Simulated cast (seeded)
2 DBAs (rmehta, spatil) · 2 sysadmins (akulkarni, pjoshi) · net admin (vdeshmukh) ·
app admin (nshinde) · **ext_dsouza — dormant vendor contractor, the demo's attacker**.

`python -m app.simulator.seed --fresh --days 14` generates ~14 weekdays of believable
normal history: business-hours sessions, consistent per-user IP/geo/device, small DB
queries (1–200 records), occasional config changes → ~666 events, ~90 sessions.

---

## 6. Detection engine (the core IP)

### 6a. Rule engine — `app/detection/rules.py`
Each rule returns a reason string + weight when it fires:

| Rule | Fires when | Weight |
|---|---|---|
| DORMANT_REACTIVATION | a dormant account logs in | 30 |
| PRIVILEGE_ESCALATION | any PRIV_CHANGE event in the session | 25 |
| AFTER_HOURS_ACCESS | privileged actions between 00:00–06:00 | 20 |
| MASS_EXPORT | ≥ 1000 records touched in one session | 30 |
| NO_BUSINESS_RELATIONSHIP | touches resources outside the user's role | 15 |

### 6b. UEBA — `app/detection/ueba.py`
Every session becomes a 7-feature vector:
`[login_hour, event_count, total_records, distinct_resources, config_changes, offsite_ip, new_device]`

- An **IsolationForest** (100 trees) is trained on all historical normal sessions.
- A new session's raw anomaly score is normalized to **0–100** against the baseline
  distribution (median → 0, 1st percentile → 100).
- **Peer comparison:** the session's records-touched is compared with the same-role
  average → "touched 5300× more records than CONTRACTOR peers".
- The model trains in < 1 s at API startup from the DB (no model files to ship).

### 6c. Risk score — `app/detection/score.py`

```
score = min( rule_weights (capped 65) + 0.35 × UEBA_anomaly + peer_bonus (10 if ≥5× peers), 100 )
```

Every score ships with a **human-readable reason list** — this is the "why flagged"
panel on the dashboard and the auditor's explanation. Typical results: normal sessions
score ~5–25; the demo attack scores **100**.

### 6d. Adaptive response — `app/detection/response.py`

| Score | Action | Severity |
|---|---|---|
| ≥ 85 | **BLOCK** the session | CRITICAL |
| ≥ 70 | MAKER_CHECKER (second-person approval) | CRITICAL |
| ≥ 40 | STEP_UP_MFA (re-authenticate) | WARNING |
| < 40 | ALLOW | INFO |

Every non-ALLOW decision persists an `Alert` and is broadcast over the WebSocket.

---

## 7. The demo attack scenario

`POST /demo/attack` (or the dashboard's **Trigger Attack** button) runs `trigger_attack()`:

> **02:00** — dormant vendor account `ext_dsouza` logs in from an unknown VPN IP
> (103.94.55.7, unregistered laptop) → **02:02** escalates privilege on
> `core-banking-db` → **02:05** probes 300 records → **02:09** bulk-exports **5000
> customer records**.

Prahari's live verdict (actual output): **score 100/100 → BLOCK → CRITICAL alert** with
7 reasons — dormant reactivation, privilege escalation, 4 after-hours actions, 5300
records over threshold, out-of-role resource access, 100/100 behaviour anomaly, 5300×
peer deviation — pushed to the dashboard in real time.

---

## 8. Post-quantum security layer (Phase 4 — next up)

- **Why:** "harvest now, decrypt later" — data stolen today can be decrypted once
  quantum computers mature. Banks need quantum-resistant protection *now* for
  long-lived secrets and evidence.
- **Credential vault** (`security/vault.py`): privileged credentials encrypted with
  AES-256-GCM; the AES key is wrapped using **ML-KEM-768** key encapsulation
  (NIST FIPS 203). `store_secret()` / `get_secret()`.
- **Tamper-evident audit log** (`security/audit.py`): every entry carries the hash of
  the previous entry (blockchain-style chain) and an **ML-DSA-65** signature
  (NIST FIPS 204). `verify_chain()` walks the whole log.
- **Live "you can't touch the log" moment:** `POST /demo/tamper` flips one stored audit
  entry → `verify_chain()` returns **FAIL**, on stage, in one click.
- All PQC calls go through one abstraction (`security/pqc.py`) so the provider
  (liboqs-python / quantcrypt) is swappable.

---

## 9. Current API surface

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /users` | list privileged users |
| `GET /sessions/{id}/score` | risk-score any session, with reason breakdown |
| `GET /alerts` | recent alerts (newest first) |
| `POST /demo/attack` | run the insider-attack scenario end-to-end |
| `WS /ws/feed` | live JSON stream of `score` and `alert` frames |

Interactive docs: `http://127.0.0.1:8000/docs` (FastAPI auto-generated).

---

## 10. Build plan & status

| Phase | Content | Status |
|---|---|---|
| 0 | Scaffold: FastAPI, /health, venv, Docker, run.sh, pytest | ✅ done |
| 1 | Data model + normal-day simulator + seeder | ✅ done |
| 2 | Rule engine + UEBA + 0–100 risk scoring + scoring API | ✅ done |
| 3 | Attack trigger + adaptive response + WebSocket live feed | ✅ done |
| 4 | PQC: ML-KEM vault, ML-DSA signed audit chain, tamper demo | ✅ done |
| 5 | React SOC dashboard: risk gauge, alert feed, session timeline, user×risk heatmap, "why flagged" panel, Trigger-Attack + Tamper buttons | ⏳ next |
| 6 | Demo hardening: one-command offline start, DEMO_SCRIPT.md narration, recorded fallback | pending |
| 7 | *(optional stretch)* correlate privileged change → suspicious downstream transaction (PS2 tie-in) | if time |

**Quality gate:** every phase ends with the project running, tests green, and one git
commit. Test suite currently **11/11 passing** (simulator realism, each rule,
normal-vs-attack scoring, response thresholds, full attack-over-WebSocket loop).

---

## 11. How to run it (any teammate, offline)

```bash
git clone <repo> && cd PRAHARI
./run.sh                                      # venv + deps + API on :8000
# second terminal:
.venv/Scripts/python -m app.simulator.seed --fresh    # 14 days of normal history
curl -X POST http://127.0.0.1:8000/demo/attack        # watch the insider get caught
curl http://127.0.0.1:8000/alerts                     # the CRITICAL BLOCK alert
```

Tests: `.venv/Scripts/python -m pytest` · Docker: `docker compose up --build`

---

## 12. Repo map

```
PRAHARI/
├── app/
│   ├── main.py               FastAPI app + lifespan (DB init)
│   ├── config.py             pydantic settings (.env driven)
│   ├── api/routes.py         REST + WebSocket endpoints
│   ├── api/ws.py             WebSocket broadcast manager
│   ├── detection/rules.py    rule engine (5 weighted rules)
│   ├── detection/ueba.py     IsolationForest + peer baseline
│   ├── detection/score.py    combined 0–100 risk score + reasons
│   ├── detection/response.py adaptive access control ladder
│   ├── models/db.py          engine/session/init
│   ├── models/entities.py    6 ORM entities
│   ├── simulator/normal.py   normal banking-day generator
│   ├── simulator/attack.py   the 2 AM insider attack
│   ├── simulator/seed.py     CLI seeder
│   └── security/             (Phase 4: pqc.py, vault.py, audit.py)
├── frontend/                 (Phase 5: React SOC dashboard)
├── tests/                    11 tests, all passing
├── run.sh · Dockerfile · docker-compose.yml · requirements.txt · .env.example
└── PROJECT_STATUS.md         this document
```

One commit per phase on `master`.

---

## 13. Scalability & production story (for Q&A)

- SQLite → **Postgres** is a connection-string change (pure ORM, no raw SQL).
- Event ingestion generalizes to PAM/SIEM feeds (CyberArk, Splunk) mapping into the
  same `Event` schema; WebSocket fan-out scales behind a message broker.
- IsolationForest retrains per role/shift nightly; the optional autoencoder upgrade
  slots behind the same UEBA interface.
- PQC algorithms are the NIST-standardized ones (FIPS 203/204) already mandated in
  US federal migration timelines — ahead of RBI's expected quantum-readiness guidance.
