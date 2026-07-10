# Prahari — Complete Demo & Usage Guide

*The sentinel for privileged access — detect with explainable AI + rules, respond in real time, remove standing privilege, and keep the proof quantum-safe.*

This one file is everything you need: **how to set up**, **how to use every feature**, the **timed judge demo script**, **Q&A answers**, and the **numbers to quote**.

---

## The scorecard — PS1 vs Prahari (memorise this table)

| Problem statement asks for | Prahari delivers | Where you show it |
|---|---|---|
| Detect misuse of privileged accounts | 11-rule engine + session recording + banking fraud gates | Action Console, Replay, Payments |
| Identify insider threats **in real time** | every action scored & enforced *before it executes*; WebSocket push | two-computer live demo |
| **AI-driven behavioural analysis** | IsolationForest UEBA + per-user baselines + **measured**: 100% detection, 0 false blocks | AI Model Insights |
| **Risk-based access control** | ALLOW → MFA → maker-checker → BLOCK, insider-type-aware | the three scenarios |
| **Risk-Based Authentication** | risky logins must pass step-up MFA **at the door** | ext_dsouza login |
| Protect critical administrative systems | server-side blocks, account lockout, **JIT access**, **credential checkout**, access review | JIT desk, Credential Vault |
| **Quantum-Proof Cryptography** | ML-KEM-768 vault · ML-DSA-65 signed audit chain · signed incident reports | Verify / Tamper, Evidence pack |

All six expected outcomes plus every focus area — including **PAM** (recording, access review, JIT, checkout) and **Risk-Based Authentication** — are live in the product, verified by **54 automated tests**.

---

## 1 · Setup

### Requirements

Python 3.11+, a browser. **No compiler, no cmake, no internet at demo time.** The post-quantum layer auto-selects: native `liboqs` if present, otherwise a pure-Python provider — it runs on any teammate's laptop.

### Start (always start fresh for a demo)

```powershell
.\run.ps1 -Reset        # wipes + reseeds DB, trains baseline, serves on :8000
```

> **Always use `-Reset` before a demo** — a previous run may have tampered the audit
> chain (that's the point of the Tamper button) and locked accounts.

`run.ps1` prints two URLs — **This computer** (`http://localhost:8000`) and **Other computers** (`http://<LAN-IP>:8000`).

### Two-computer demo (recommended — this is the "wow")

- **Computer 1 (SOC big screen):** `http://localhost:8000` → sign in `soc_admin`. Leave on **Overview**; the header shows a green **LIVE** dot.
- **Computer 2 (employee):** same Wi-Fi, open the LAN URL → sign in as the employee accounts below.

Everything the employee does appears on the SOC screen **instantly** — no refresh. If Computer 2 can't connect, allow port 8000 through Windows Firewall on Computer 1:
`New-NetFirewallRule -DisplayName Prahari -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow`

Single laptop: two browser windows side by side works just as well.

### Accounts (all password `prahari123` · MFA code `246810`)

| Login | Who | Use for |
|---|---|---|
| `soc_admin` | Meera Nair, SOC analyst | the **SOC Console** |
| `rmehta` | Rajesh Mehta, DBA | the **normal employee** / transfer **maker** (banking, JIT, vault) |
| `dgokhale` | Deepa Gokhale, Officer | the **second officer** / **checker** who approves or clears transfers |
| `ext_dsouza` | Kevin D'Souza, dormant vendor | the **malicious attacker** (gets MFA-challenged at login) |
| `ext_rao` | Priya Rao, vendor w/ expired access | the **negligent** case |

---

## 2 · Every feature and how to use it

### 2.1 Risk-based authentication (the front door)

- `rmehta` signs in with just a password — trusted context, straight in.
- `ext_dsouza` signs in → **amber step-up screen** listing *why*: dormant account waking up · access expired 120 days ago · unrecognized network/device. Enter `246810` to proceed.
- A wrong code = 401 + a WARNING alert on the SOC + an audit entry. Every challenge/verification is sealed to the audit chain.

**The line to say:** *"A stolen password is not enough. The same signals our detection engine scores are checked at login — and even when the attacker passes MFA, the behavioural engine is waiting inside."*

### 2.2 Employee Portal — the banking desk (login as `rmehta`)

| Tab | What it does |
|---|---|
| **Dashboard** | live KPIs: accounts, pending approvals, deposits, session risk gauge |
| **Customer Accounts** | 6 seeded accounts, masked numbers, live balances, status (one FROZEN) |
| **Payments & Transfers** | real transfers: ≤ ₹2L **CLEARS** instantly · > ₹2L **HELD** for a second officer · watchlisted payee (⚠), ≥ ₹10L, or session risk ≥ 70 → **FLAGGED** as fraud with a red flash banner + CRITICAL SOC alert |
| **Transactions** | the live ledger with statuses and fraud reasons |
| **Approvals** | two queues: **maker-checker** (a *different, authorized* officer Approves→money moves / Rejects) and **fraud review** (an officer Clears a false-positive or Confirms the fraud→blocked). The maker never sees action buttons on their own item — segregation of duties is enforced server-side. |

### 2.3 Action Console (privileged actions — the detection surface)

Pick a target system + record count, then: **Run query · Open file · Change config · Escalate privilege · Bulk export**. Every click is scored 0–100 *including the candidate action* and enforced **before it takes effect**:

- **0–39 ALLOW** (green) · **40–69 STEP-UP MFA** (amber pop-up, code `246810`) · **70–84 MAKER-CHECKER** (held) · **85+ BLOCK** (full-screen red, account locked)
- Challenged actions are **not saved until allowed** — you can't game the score by retrying.

### 2.4 Credential Vault (PQC checkout — SECURITY → Credential Vault)

Three privileged secrets live **ML-KEM-768-sealed**: core-banking DB root, payment-gateway API key, SWIFT cert passphrase.

- **Check out** → the secret unseals for a **5-minute lease** with a live countdown, then vanishes. The checkout is ML-DSA-signed into the audit chain.
- If your live session risk is **≥ 70 or blocked** → **refusal + CRITICAL SOC alert** — and the refusal itself is recorded evidence.

**The line:** *"PAM, risk scoring, and post-quantum crypto in one click: the vault only opens for a trusted session, and either way it leaves signed evidence."*

### 2.5 JIT Access (no standing privilege — SECURITY → JIT Access)

1. On the Action Console, click **Escalate privilege** with no grant → the reason panel shows *"Privilege change … outside normal grant process"* (malicious signal, +25).
2. On **JIT Access**, request elevation for that system with a justification + duration (max 60 min).
3. The SOC analyst approves it in **JIT & Credentials** → your grant goes **ACTIVE** with a countdown.
4. Click **Escalate privilege** again → *"privilege change sanctioned by an approved JIT grant"* — no alarm.
5. The grant **auto-expires**; the rule re-arms by itself.

### 2.6 SOC Console (login as `soc_admin`)

| View | What it shows |
|---|---|
| **Overview** | impact metrics strip, live sessions, selected-session gauge, **Analyst Response** (Lock / Approve / Dismiss / **⬇ Evidence pack**), why-flagged, alerts, timeline, session replay |
| **Live Sessions** | every ACTIVE/BLOCKED privileged session, typed and scored |
| **Alerts** | severity + insider-type-coded feed, flashes on arrival |
| **Threat Analysis** | gauge + why-flagged + response actions for the selected session |
| **AI Model Insights** | feature attribution vs the user's own + peer baselines, risk trajectory sparkline, model card, and **Measured Performance** (the held-out benchmark) |
| **Session Replay** | the recorded command transcript — blocked commands struck through as DENIED |
| **Risk Heatmap** | user × day risk grid |
| **PAM Access Review** | dormant / vendor / expired flags per privileged account |
| **JIT & Credentials** | JIT approval queue (Approve/Deny) + every credential checkout and refusal |
| **Audit Chain** | the hash-chained, ML-DSA-signed log with **⛓ Verify** and **✂ Tamper** |

Header buttons: **☠ Malicious / 🎭 Compromised / ⚠ Negligent** run the three scripted scenarios; **✂ Tamper / ⛓ Verify** drive the quantum-safe evidence moment.

**Analyst response actions** (Overview / Threat Analysis): **⛔ Lock account** (kills the session, next login refused) · **✓ Approve** and **⊘ Dismiss** (mark the session **reviewed** — its row turns green/neutral and drops out of the critical count, while the true score stays as the historical record) · **⬇ Evidence pack** (downloads the ML-DSA-signed incident report JSON). Every decision is sealed to the audit chain with a toast confirming it. When an officer resolves a flagged transfer, its banking alert clears from the feed too.

---

## 3 · The judge demo — 8 minutes, six outcomes in order

Setup: SOC Console on the big screen (`soc_admin`), employee machine ready. Say the bold lines.

### 0:00 — Open on the SOC (30s)

Quiet console, green heatmap, impact-metrics strip, green LIVE dot.
**"This is Prahari — the sentinel between privileged staff and a bank's core systems. Right now: normal day, every session watched, audit chain quantum-sealed."**

### 0:30 — Risk-based authentication (45s) · *Outcome: risk-based auth*

On the employee machine, sign in as `ext_dsouza`. The amber challenge appears listing the three reasons.
**"A dormant vendor account just woke up — a password alone doesn't get in. Risk-based authentication challenges it at the door."** Enter `246810`: **"Our attacker has phished the OTP — watch what happens to him inside."** *(Leave him logged in — he's Act 4.)*

### 1:15 — Real banking + a normal employee (75s) · *Outcome: detect misuse / protect systems*

Second employee window: `rmehta` (straight in — trusted). Show the **banking desk**: transfer ₹50,000 → **CLEARED**. Transfer ₹5,00,000 → **HELD for maker-checker**. Pay "QuickCash Holdings ⚠" → red **FRAUD flash** + point at the SOC screen: the CRITICAL alert just landed.
**"This is a real banking floor. Big money needs two officers; a watch-listed payee stops the money and alerts the SOC in the same second."**

**Segregation of duties (optional 30s):** open **Approvals** as `rmehta` — the held item reads *"you initiated this — another officer must approve"* (no buttons). Sign in as **`dgokhale`** (the officer), open **Approvals**, and **Approve** → money moves and the ledger shows the transfer with a ✓ and the checker's name. In **Fraud review**, the officer **Clears** the flagged QuickCash transfer or **Confirms fraud** (blocked permanently).
**"The maker can never approve their own transfer. The checker must be a different, authorized officer — and every decision is signed into the audit chain naming both people."**

> **Order matters — do JIT + vault next, the big export last.** Money transfers add no session risk, so rmehta is still "clean" for the access beat. If you run the 1,200-record export *first*, its risk stacks with the escalation and rmehta gets *blocked* before you can show JIT — correct behaviour, wrong demo order.

### 2:30 — JIT + the quantum vault (75s) · *Outcome: PAM / protect systems*

Still `rmehta`, clean session. On the **Action Console** click **Escalate privilege** → it's **allowed but flagged** — open the result/why panel: *"privilege change outside normal grant process."*
**"On its own that's just noted — but there's a right way to do this."**
Go to **JIT Access**, request a grant ("schema migration, 15 min"); approve it on the SOC (**JIT & Credentials** — the badge is already lit). Back on the console, **Escalate privilege** again → the reason is gone: *"sanctioned by an approved JIT grant."*
**"No standing privilege: elevation is approved, time-boxed, auto-expiring — the engine stands down for exactly that grant, then re-arms when it lapses."**

Open **Credential Vault** → check out the core-banking root password → the secret appears with a 5-minute countdown.
**"Secrets live sealed under ML-KEM-768 — quantum-safe. The vault opens only for a trusted session, for five minutes, with a signed receipt."**

### 3:45 — Proportionate response: the big export (30s) · *Outcome: risk-based access control*

Last `rmehta` action, on the **Action Console**: **target core-banking-db**, export **1,200 records** → **STEP-UP MFA** pop-up → enter `246810` → allowed. *(Keep the target on core-banking-db — his home system; the same export on a system outside his role is held for maker-checker instead, which is also correct but a different beat.)*
**"Unusual volume for a genuine DBA: the response is proportionate — verify, not block. The activity log updates a second later."**

### 4:15 — The attack (75s) · *Outcomes: real-time detection + response*

Back to `ext_dsouza`: escalate privilege → held. Then **bulk export 5,000 records** → **full-screen red BLOCK**, account locked. The SOC screen lights up by itself: red session at 100, flashing CRITICAL alert typed **MALICIOUS**, replay shows the export **struck through — DENIED**.
Try the vault as the attacker → **checkout refused**. Log him out and back in → **still locked**.
**"Caught mid-action, before the data left. The block is server-side, the account stays dead, and even the vault refuses him — and every refusal is evidence."**

### 5:30 — Three insider types + explainable AI (75s) · *Outcome: AI behavioural analysis*

SOC buttons: **🎭 Compromised** → STEP-UP MFA (Singapore + new device + inhuman pace). **⚠ Negligent** → MAKER-CHECKER (expired vendor, personal laptop — *"we never auto-block a careless employee; a human reviews"*).
Open **AI Model Insights**: feature bars vs personal + peer baselines, the risk trajectory climbing, and **Measured Performance**:
**"We didn't just build AI, we measured it: on a held-out month — 230 benign sessions — 100% of attacks detected with the correct response and type, zero false blocks, 1.7% false alarms."**

### 6:45 — Quantum-safe evidence + closed loop (60s) · *Outcome: QPC*

**⛓ Verify** → green, every signature valid. **✂ Tamper** → the chain fails **at the exact entry**, banner turns red.
**"An insider who edits the evidence would need to forge a NIST post-quantum signature."**
Click **⬇ Evidence pack** on the blocked session: **"One click — replay, trajectory, model reasoning, audit extract — sealed with an ML-DSA-65 signature. This is what compliance hands to the RBI."**
Finally **⛔ Lock account** on any remaining flagged session — the toast confirms it's sealed to the chain.

### 7:45 — Close (30s)

**"Six outcomes, all live: detection, real time, measured AI, risk-based control from login to logout, protected admin systems with JIT and a quantum vault, and evidence that can't be silently edited. Prahari runs offline, on any laptop, with 54 passing tests — and everything you saw was two computers talking over this Wi-Fi."**

---

## 4 · Judge Q&A — quick answers

- **"Real AI or rules?"** Both, fused: IsolationForest (scikit-learn) trained on behavioural history + per-user baselines contributes up to 25 points; the explainable rule engine sets the band. Feature attribution is on the Model Insights page.
- **"How do you know it works?"** Held-out benchmark, independent seed: 100% detection / correct typing / correct response on the three attack patterns, 0 false blocks on 230 benign sessions, 1.7% false-alarm rate. Plus 54 pytest tests.
- **"False positives?"** A challenge is cheap (10-second MFA), a block is rare (0 on benign). Negligence is floored to human review — never auto-blocked.
- **"Why is negligent not blocked?"** Type-aware policy: a careless employee is a control failure to *remediate* (maker-checker), not an attack. Enforced in `decide()` and tested.
- **"What's quantum-proof exactly?"** FIPS 203 ML-KEM-768 seals the credential vault (the AES key *is* the KEM shared secret — defeats harvest-now-decrypt-later). FIPS 204 ML-DSA-65 signs every audit entry and incident report over a hash chain.
- **"What if liboqs won't install?"** Pure-Python fallback (kyber-py / dilithium-py) auto-selected; same algorithms, same tests pass. `GET /pqc/info` shows the active provider.
- **"How does this scale?"** Stateless scoring behind a load balancer; SQLite→PostgreSQL is one connection string; WebSocket fans out via Redis/Kafka; the same Event schema ingests PAM/SIEM feeds (CyberArk, Splunk).
- **"Production auth?"** Demo IdP by design — PBKDF2 + signed tokens behind one dependency; a bank swaps in SSO/AD without touching the engine.
- **"Can the employee bypass the browser?"** No — enforcement is server-side; the API refuses. Blocked stays blocked across logins; challenged actions aren't persisted (no score-gaming).
- **"GDPR / PII?"** Scores activity metadata only; no customer PII needed.

---

## 5 · Numbers to quote

| Number | Meaning |
|---|---|
| **54** | automated tests, all passing |
| **11** | detection rules across the 3 insider types |
| **0–100 / <1s** | risk score per action, scored before it executes |
| **100% / 0 / 1.7%** | detection rate / false blocks / false alarms on the held-out benchmark |
| **25 pts max** | UEBA's capped contribution (AI refines, rules stay explainable) |
| **₹2L / ₹10L** | maker-checker threshold / auto-fraud threshold |
| **5 min / 60 min** | credential-checkout lease / max JIT grant |
| **ML-KEM-768 + ML-DSA-65** | FIPS 203/204 — vault + signed audit chain |
| **2 computers** | live over LAN, offline, no refresh |

---

## 6 · Troubleshooting

| Symptom | Fix |
|---|---|
| Audit chain shows FAILED at start | you demoed Tamper earlier — `.\run.ps1 -Reset` |
| Attacker account already blocked | previous run — `.\run.ps1 -Reset` |
| Computer 2 can't reach the server | firewall: allow TCP 8000 on Computer 1 (command in §1) |
| "LIVE" dot red / reconnecting | it auto-reconnects with backoff; a polling fallback keeps data fresh anyway |
| liboqs error on a teammate's laptop | none needed — the pure-Python fallback loads automatically; force it with `PRAHARI_PQC=pure` |
| MFA pop-up rejects the code | the demo code is exactly `246810` |
| Evening demo flags after-hours | it won't — the demo business-clock anchors live actions to business hours |

**Reset between runs:** Ctrl+C the server → `.\run.ps1 -Reset`.

**Fallback:** screen-record one clean run (~5 min, both windows visible) the night before: risky login challenge → banking (clear/held/fraud flash) → JIT sanctioned escalation → vault checkout → attack blocked → Model Insights + Measured Performance → Verify/Tamper → Evidence pack. Store it on the laptop **and** a phone.
