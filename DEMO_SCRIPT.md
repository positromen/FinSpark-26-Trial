# Prahari — Demo Script (5–6 minutes)

Click-by-click narration for the FinSpark'26 live demo.

---

## Before you leave for the venue (needs internet, once)

1. `git clone` the repo on the demo laptop.
2. Run `.\run.ps1` (or `./run.sh` in Git Bash) once — this creates the venv,
   installs Python deps, and (first time only) builds liboqs. Wait for
   "SOC dashboard -> http://127.0.0.1:8000", open it, click **Trigger Attack**
   once to confirm everything works.
3. Record the fallback video (checklist at the bottom).

## At the venue (no internet needed)

```powershell
.\run.ps1 -Reset      # clean DB, fresh 14-day baseline, server up
```

Open **http://127.0.0.1:8000** in a maximized browser window. Zoom ~110–125%
so the back row can read it. Close every other tab.

---

## The demo (narration + clicks)

### 0:00 — Set the scene *(no clicks)*

> "Banks are well defended against outsiders. But the costliest breaches come
> from **insiders** — the DBA, the sysadmin, the vendor contractor who already
> has privileged access. This is Prahari: a sentinel that watches privileged
> users, scores their behaviour in real time with AI, responds automatically,
> and keeps its evidence quantum-safe."

Point at the screen:

> "This is a live SOC view of a bank's privileged users — two DBAs, two
> sysadmins, a network admin, an app admin. The gauge is green: everyone is
> behaving normally today. The heatmap shows each user's risk per day for the
> last two weeks — all quiet. The system learned this 'normal' itself: an
> IsolationForest model trained on every user's behavioural history — login
> hours, data volumes, resources, devices."

### 1:00 — Introduce the attacker *(point at heatmap bottom row)*

> "One more account: **ext_dsouza** — a vendor contractor whose engagement
> ended months ago. The account was never deactivated. Dormant. Every bank
> has these. Watch what happens when it wakes up at 2 AM."

### 1:30 — Click **▶ Trigger Attack**

Let the dashboard react, then walk it:

> "2 AM. The dormant account logs in from an unregistered laptop on an unknown
> VPN exit. Escalates its own privileges on the **core banking database**.
> Bulk-exports **5,000 customer records**."

- **Gauge**: "Risk score 100 out of 100 — and the response is **BLOCK**. Not
  an email to be read tomorrow morning — the session is stopped *while the
  export is happening*. At lower scores Prahari responds proportionately:
  forced re-authentication at 40, four-eyes approval at 70."
- **Alerts feed**: "The SOC analyst gets the alert in under a second, over a
  live WebSocket."
- **Why flagged panel**: "And crucially — *explainable* AI. Five rule hits:
  dormant reactivation, privilege escalation, after-hours activity, mass
  export, no business relationship with that database. Plus the behavioural
  model: 100/100 anomaly, thousands of times more data than any contractor
  peer ever touched. An auditor can read this."
- **Timeline**: "The full forensic trail: login, escalation, probe, export —
  who, what, when, from where."
- **Heatmap**: "And ext_dsouza's row just caught fire."

### 3:30 — The quantum-safe evidence

> "Now — a smart insider's next move is to **edit the audit log** and erase
> the evidence. And 'harvest-now-decrypt-later' means anything protected with
> classical crypto today could be readable in a few years. So Prahari's
> evidence layer is post-quantum: every audit entry is hash-chained to the
> previous one and signed with **ML-DSA-65** — the NIST-standardized
> post-quantum signature. Credentials sit in a vault sealed with **ML-KEM-768**."

Click **⛓ Verify Audit Chain**:

> "Green — every entry hash-linked, every signature valid."

Click **✂ Tamper Audit Log**:

> "Now I'm the insider: I just flipped that BLOCK verdict to ALLOW directly in
> the database — the classic cover-up. Verification instantly fails, and points
> at the exact entry. The attacker would need to break a post-quantum signature
> scheme to cover their tracks. The log is mathematically tamper-evident."

### 5:00 — Close

> "So: **detect** with AI plus rules, **explain** every decision, **respond**
> in real time — MFA, four-eyes, or block — and **protect the evidence** with
> NIST post-quantum cryptography. It runs fully offline today on SQLite, and
> it's a connection-string away from Postgres, with the same event schema any
> PAM or SIEM can feed. That's Prahari — the sentinel for privileged access."

---

## Judge Q&A quick answers

- **Real data sources?** Any PAM/SIEM (CyberArk, Splunk) maps to our Event
  schema; the simulator is just the demo feed.
- **False positives?** Score is graduated — low anomalies only trigger MFA,
  not blocks; thresholds are per-bank policy. Explanations make triage fast.
- **Why IsolationForest?** Unsupervised (no labeled attacks needed), fast,
  well-understood. Architecture accepts an autoencoder as a drop-in upgrade.
- **PQC performance?** ML-KEM encap + ML-DSA sign are both sub-millisecond —
  negligible next to any database write.
- **Scale?** Stateless scoring service; Postgres + a message broker for
  fan-out; model retrains nightly per role.

## Fallback recording checklist (record before the event)

Screen-record one clean run (OBS or Xbox Game Bar, Win+Alt+R), ~3 minutes:

1. Dashboard loading, green gauge, quiet heatmap (10 s hold)
2. Click Trigger Attack → gauge to 100/BLOCK, alert arriving, why-panel,
   timeline, red heatmap cell (hold each ~10 s)
3. Verify Audit Chain → green banner
4. Tamper Audit Log → red FAILED banner
5. `GET /docs` page scroll (shows the real API) — optional 10 s

Store it on the laptop **and** a phone. If the live demo misbehaves, narrate
over the recording with the same script above.

## Reset between demo runs

```powershell
# stop the server (Ctrl+C), then:
.\run.ps1 -Reset
```
