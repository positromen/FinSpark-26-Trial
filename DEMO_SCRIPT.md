# Prahari — Demo Script (6–7 minutes)

Prahari is now a **two-sided product**:

- **Employee Portal** — privileged bank staff log in and perform real actions
  (query, export, config change, privilege escalation). Every action is scored
  and enforced live.
- **SOC Console** — the security team logs into Prahari itself and watches every
  privileged session in real time, with alerts, a risk heatmap, and the
  post-quantum audit log.

The demo is best run with **two browser windows side by side**: the SOC Console on
the left, the Employee Portal on the right.

---

## Accounts (all password `prahari123`)

| Username | Who | Use for |
|---|---|---|
| `soc_admin` | Meera Nair, SOC analyst | the **SOC Console** (left window) |
| `rmehta` | Rajesh Mehta, DBA | a **normal employee** |
| `ext_dsouza` | Kevin D'Souza, dormant vendor | the **attacker** |

MFA step-up code (demo): **`246810`**

---

## Setup at the venue (offline)

```powershell
.\run.ps1 -Reset        # clean DB + baseline history, server on :8000
```

`run.ps1` prints two URLs — **This computer** (`http://localhost:8000`) and
**Other computers** (`http://<LAN-IP>:8000`).

### Two-computer demo (recommended)

Run the server on **one** laptop (the SOC machine). Then:

- **Computer 1 — SOC big screen:** open `http://localhost:8000`, sign in as
  `soc_admin`. Leave it on the **Overview** — the header shows a green **LIVE** dot.
- **Computer 2 — employee:** on the same Wi-Fi, open the **Other computers** URL
  (`http://<LAN-IP>:8000`) and sign in as `rmehta` / `ext_dsouza` / `ext_rao`.

Everything the employee does on Computer 2 appears on Computer 1 **instantly** — the
session shows up on login, the score climbs per action, alerts flash, the block lands,
and the SOC screen auto-follows the flagged session. No refreshing, no buttons needed.

> First time only: if Computer 2 can't reach the server, allow **port 8000** through
> Windows Firewall on Computer 1 (accept the prompt on first `run.ps1`, or:
> `New-NetFirewallRule -DisplayName Prahari -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow`).

### Single-laptop demo

Open **http://localhost:8000** in two browser windows side by side; log one in as
`soc_admin` and the other as an employee. The scenario buttons on the SOC header
(☠ / 🎭 / ⚠) also drive the whole story from one screen if you prefer.

---

## The demo

### 0:00 — The SOC Console (left window, logged in as soc_admin)

> "This is Prahari's security operations console. It's watching the bank's
> privileged users — DBAs, sysadmins, a network admin, an app admin. Right now
> everyone's quiet. This heatmap is each user's risk over the last two weeks —
> all green. Prahari learned what 'normal' looks like for each person using an
> IsolationForest behavioural model trained on their real history."

### 1:00 — A normal employee works (right window)

Log in as `rmehta` / `prahari123`. You're now in the **Employee Portal** as a DBA.

> "This is what a bank admin sees — a privileged-access portal. I'm Rajesh, a
> database admin. Let me do my normal job."

- Select **core-banking-db**, set records ~80, click **Run database query**.
  → green **ALLOWED**, risk stays low. Point to the left window:
- "On the SOC side, my session just appeared as a live green session."

Now push it:

> "What if I try to pull a lot of data at once?"

- Set records to **1000**, click **Bulk export records**.
  → a **Step-up MFA** modal appears. "Prahari didn't block me — it wasn't clearly
  malicious — but it wasn't sure, so it asked me to re-authenticate. That's
  risk-based access control." Enter **246810** → the action proceeds.

### 2:30 — The insider attack (right window)

Sign out; log in as **`ext_dsouza`** / `prahari123`.

> "Now the dangerous one. Kevin is a vendor contractor whose contract ended
> months ago — but his privileged account was never deactivated. It's dormant.
> Notice the portal itself flags it: he's connecting from an **unregistered
> laptop on an unknown VPN**, not a bank workstation."

Point to the red connection banner, then:

- Select **core-banking-db** (a system he has no business touching — it's under
  "other systems, outside my role"), click **Escalate privilege**.
  → **MAKER-CHECKER**: "held for a second approver. Prahari already considers this
  high-risk — a dormant vendor escalating rights on the core banking DB."
- Now the theft: records **5000**, click **Bulk export records**.
  → **full-screen ⛔ ACCESS BLOCKED.** "The session is terminated *mid-export*.
  He never gets the 5,000 customer records."
- Try any other action → still blocked. "The account is locked. He can't even
  log in again to retry."

### 3:00 — The other two insider types (SOC buttons)

The problem statement names three insider types — **malicious, negligent, compromised**.
The header has a one-click button for each; they drive *different* responses:

- **☠ Malicious** → the 2 AM dormant-vendor theft you just saw live → **BLOCK**.
- **🎭 Compromised** → click it: a *normal* sysadmin's account suddenly logs in from
  Singapore on an unknown laptop and fires six actions in 90 seconds. Prahari reads it
  as account takeover → **STEP-UP MFA**. The alert is tagged `compromised`.
- **⚠ Negligent** → click it: an active vendor whose access *expired 18 days ago* keeps
  pulling reports from a personal laptop. No malice — a control failure → **MAKER-CHECKER**
  review (Prahari never hard-blocks negligence, it routes it to a human). Tagged `negligent`.

> "Same engine, three different responses, each labelled with *what kind* of insider it is."

### 3:30 — The PAM surface (scroll down, left window)

> "This is privileged-access *management*, not just detection."

- **PAM access review** (bottom panel): every privileged account with standing-risk flags —
  ext_dsouza is DORMANT + VENDOR + EXPIRED (HIGH), ext_rao is VENDOR + EXPIRED (HIGH). This
  is the lingering-access problem surfaced before anything even happens.
- **Session recording** (replay panel): click any session → its full recorded command trail
  replays like a terminal. On Kevin's blocked session you can see the export line marked
  **DENIED** and struck through — the action that never completed.

### 3:45 — Watch the malicious case on the SOC side (left window)

> "Everything just lit up here in real time."

- The **live session** for ext_dsouza is now red, score **100**, **BLOCKED**.
- The **alert** flashed into the feed — CRITICAL, BLOCK.
- Click his session → the **Why flagged** panel: dormant reactivation, privilege
  escalation, mass export of 5,000 records, out-of-role access, 100/100
  behavioural anomaly, 5,000× the data any contractor peer touches.
- The **timeline** shows exactly what he did, from where.
- His **heatmap** row is now bright red.

> "Detected, explained, and stopped — in under a second, with a reason a human
> auditor can read."

### 5:00 — The quantum-safe evidence (left window)

> "A smart insider's next move is to edit the audit log and erase the evidence.
> And 'harvest-now-decrypt-later' means classical crypto isn't safe for long-lived
> secrets. So Prahari's evidence layer is post-quantum."

- Click **⛓ Verify Chain** → green: every entry hash-linked, **ML-DSA-65**
  signatures valid. Credentials sit in an **ML-KEM-768** vault.
- Click **✂ Tamper Audit Log** → red banner: **verification FAILS**, pointing at
  the exact entry. "I just rewrote a log record in the database — and it's caught
  instantly. To hide his tracks he'd have to break a NIST post-quantum signature."

### 6:00 — Close

> "Prahari: staff act through a monitored privileged-access portal; every action
> is scored live by AI plus rules; the response is graduated — allow, step-up MFA,
> maker-checker, or block; and the evidence is sealed with NIST post-quantum
> cryptography. It runs fully offline on SQLite, and it's one connection string
> from Postgres, feeding from any PAM or SIEM. That's Prahari — the sentinel for
> privileged access."

---

## Judge Q&A quick answers

- **Is the blocking real?** Yes — the portal action API refuses to execute the
  action and freezes the session server-side. A blocked account cannot re-open a
  session.
- **How does scoring work live?** Each action re-scores the whole session so far:
  rule engine (weighted known-bad patterns) + IsolationForest behavioural anomaly
  + peer comparison, combined into 0–100. Held/challenged actions aren't persisted
  until allowed, so re-tries don't inflate the score.
- **Real data sources?** Any PAM/SIEM (CyberArk, Splunk) maps to the same Event
  schema; the portal + simulator are the demo feed.
- **Auth?** Passwords are PBKDF2-HMAC-SHA256; sessions are HMAC-signed tokens.
  Demo-grade, dependency-free; a real deployment swaps in the bank's IdP/SSO.
- **PQC performance?** ML-KEM encap + ML-DSA sign are sub-millisecond.
- **Scale?** Stateless scoring service; Postgres + a broker for fan-out; model
  retrains per role nightly.

## Fallback recording checklist (record before the event)

Screen-record one clean run (OBS / Win+Alt+R), ~4 minutes, two windows visible:

1. SOC console idle (green heatmap) + employee normal query → ALLOWED
2. Employee export 1000 → MFA modal → proceed
3. Log in as ext_dsouza → escalate (maker-checker) → export 5000 → BLOCKED overlay
4. SOC: red live session, flashed alert, why-panel, red heatmap cell
5. Verify Chain (green) → Tamper (red FAILED)

Store it on the laptop **and** a phone.

## Reset between runs

```powershell
# Ctrl+C the server, then:
.\run.ps1 -Reset
```
