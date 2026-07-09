"""Render all documentation diagrams to docs/img/*.png (matplotlib).

Run:  python docs/build_diagrams.py
"""
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

OUT = os.path.join(os.path.dirname(__file__), "img")
os.makedirs(OUT, exist_ok=True)

# palette
TEAL = "#1C607A"
BLUE = "#3987E5"
RED = "#D03B3B"
AMBER = "#E0931A"
ORANGE = "#EC835A"
GREEN = "#0C8A3C"
GREY = "#6B6B6B"
BANNER = "#0E3C4A"
LIGHT = "#EEF3F6"
INK = "#1E1E1E"
plt.rcParams["font.family"] = "DejaVu Sans"


def canvas(w, h):
    fig, ax = plt.subplots(figsize=(w, h), dpi=200)
    ax.set_xlim(0, 100); ax.set_ylim(0, 100)
    ax.axis("off")
    return fig, ax


def box(ax, x, y, w, h, text, fill=TEAL, tc="white", fs=9, bold=True, ec=None, rad=2.2):
    ax.add_patch(FancyBboxPatch((x, y), w, h,
                 boxstyle=f"round,pad=0.3,rounding_size={rad}",
                 linewidth=1.2, edgecolor=ec or fill, facecolor=fill, mutation_aspect=1))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", color=tc,
            fontsize=fs, fontweight="bold" if bold else "normal", wrap=True, zorder=5)


def arrow(ax, x1, y1, x2, y2, color=TEAL, lw=1.6, style="-|>"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style,
                 mutation_scale=12, linewidth=lw, color=color, zorder=1))


def save(fig, name):
    fig.savefig(os.path.join(OUT, name), bbox_inches="tight", pad_inches=0.15,
                facecolor="white")
    plt.close(fig)
    print("wrote", name)


# ---------------------------------------------------------------- architecture
def architecture():
    fig, ax = canvas(12, 7)
    box(ax, 2, 80, 22, 12, "Privileged activity\n(Employee Portal /\nPAM / SIEM / Simulator)", GREY, fs=9)
    box(ax, 39, 80, 24, 12, "Collection & normalization\nEvent · Session ·\nSessionCommand", TEAL, fs=9)
    arrow(ax, 24, 86, 39, 86)
    box(ax, 70, 88, 26, 9, "UEBA\nIsolationForest + peer", TEAL, fs=9)
    box(ax, 70, 75, 26, 9, "Rule engine\n(malicious / negligent /\ncompromised)", TEAL, fs=8.5)
    arrow(ax, 63, 86, 70, 92)
    arrow(ax, 63, 86, 70, 80)
    box(ax, 66, 58, 30, 11, "Risk scoring engine\n0-100 + reasons + type", BLUE, fs=9.5)
    arrow(ax, 83, 88, 82, 69)
    arrow(ax, 83, 75, 81, 69)
    box(ax, 60, 40, 22, 11, "Adaptive access control\nMFA / maker-checker /\nblock", ORANGE, fs=8.5)
    box(ax, 6, 40, 30, 11, "SOC console\nalerts · replay · heatmap ·\naccess review", TEAL, fs=8.5)
    arrow(ax, 74, 58, 71, 51)
    arrow(ax, 66, 63, 36, 46, color=GREY)
    arrow(ax, 60, 45, 36, 45, color=GREY)
    box(ax, 12, 18, 76, 12,
        "Post-Quantum Security Layer\nML-KEM-768 credential vault   +   ML-DSA-65 signed, hash-chained audit log",
        BANNER, tc="#F2C83C", fs=10)
    arrow(ax, 60, 40, 55, 30, color=GREY)
    arrow(ax, 45, 80, 45, 30, color=GREY, lw=1.0, style="-|>")
    ax.text(50, 8, "SQLite by default (offline) · Postgres-swappable via one connection string · same Event schema ingests real PAM/SIEM",
            ha="center", va="center", color=GREY, fontsize=8.5, style="italic")
    save(fig, "architecture.png")


# ---------------------------------------------------------------- data model
def datamodel():
    fig, ax = canvas(12, 8.4)
    pitch, head = 4.0, 5.5
    def ent(x, y, title, fields, w=27):
        h = head + len(fields) * pitch
        box(ax, x, y - h, w, h, "", LIGHT, ec=TEAL, rad=1.2)
        ax.text(x + w / 2, y - 3.6, title, ha="center", va="center", color=TEAL, fontsize=10, fontweight="bold")
        for i, f in enumerate(fields):
            ax.text(x + 2, y - 7.8 - i * pitch, f, ha="left", va="center", color=INK, fontsize=7.6)
        return h
    # top row
    ent(3, 97, "USER", ["username, role", "account_type", "is_dormant, is_vendor", "access_expires_at", "password_hash"])
    ent(37, 97, "SESSION", ["user_id", "status ACTIVE/CLOSED/BLOCKED", "risk_score, risk_reasons", "source_ip, geo, device", "started/ended_at"])
    ent(71, 97, "EVENT", ["session_id", "action_type", "resource, records", "ip, geo, device", "timestamp"])
    # middle row
    ent(3, 60, "AUDITLOGENTRY", ["actor, action, payload", "prev_hash", "entry_hash", "signature (ML-DSA-65)"])
    ent(37, 60, "SESSIONCOMMAND", ["session_id", "command (transcript)", "action_type, resource", "outcome EXECUTED/DENIED/HELD"])
    ent(71, 60, "ALERT", ["session_id", "severity", "action_taken", "insider_type", "message"])
    # bottom row — vault + the two core-banking tables
    ent(3, 31, "VAULTITEM", ["name", "ciphertext (AES-256-GCM)", "nonce", "kem_ciphertext (ML-KEM)"])
    ent(37, 31, "BANKACCOUNT", ["number, holder", "acc_type, branch", "balance", "status ACTIVE/DORMANT/FROZEN"])
    ent(71, 31, "BANKTRANSACTION", ["from_number, to_number", "amount, mode", "status CLEARED/HELD/FLAGGED", "maker, flagged_reason"])
    # relationships
    arrow(ax, 30, 91, 37, 91, GREY); arrow(ax, 64, 91, 71, 91, GREY)
    arrow(ax, 50, 74, 50, 60, GREY)          # SESSION -> SESSIONCOMMAND
    arrow(ax, 62, 82, 80, 60, GREY)          # SESSION -> ALERT
    arrow(ax, 64, 25, 71, 25, GREY)          # BANKACCOUNT -> BANKTRANSACTION
    ax.text(50, 3, "Privileged-access side: USER → SESSION → EVENT (+ recorded commands, alerts, audit, vault).  "
            "Core-banking side: BANKACCOUNT → BANKTRANSACTION.",
            ha="center", color=GREY, fontsize=8.0, style="italic")
    save(fig, "datamodel.png")


# ---------------------------------------------------------------- banking flow
def bank_flow():
    fig, ax = canvas(12, 4.8)
    box(ax, 3, 60, 22, 16, "Employee submits\ntransfer\n(from → payee, ₹amount)", GREY, fs=9)
    box(ax, 31, 60, 22, 16, "Banking controls\nfunds · limits · fraud ·\nsession risk", BLUE, fs=9)
    arrow(ax, 25, 68, 31, 68)
    outs = [
        ("CLEARED", GREEN, "white", "money moves,\nledger posted", 60),
        ("HELD", ORANGE, "white", "maker-checker:\n> ₹2,00,000 held\nfor 2nd approver", 60),
        ("FLAGGED", RED, "white", "suspected fraud:\nwatch-list / huge /\nhigh-risk session →\nheld + SOC alert", 60),
    ]
    ys = [78, 55, 30]
    for (lbl, col, tc, desc, _), y in zip(outs, ys):
        box(ax, 62, y, 15, 11, lbl, col, tc=tc, fs=10)
        box(ax, 79, y, 18, 11, desc, "#F2F2F0", tc=INK, fs=7.4, bold=False, ec="#DDD")
        arrow(ax, 53, 68, 62, y + 5.5, col if lbl != "CLEARED" else GREEN)
    ax.text(50, 6, "Held & flagged transfers raise a colour-coded SOC alert and are sealed into the ML-DSA-65 audit chain.",
            ha="center", color=GREY, fontsize=8.4, style="italic")
    save(fig, "bank_flow.png")


# ---------------------------------------------------------------- scoring
def scoring():
    fig, ax = canvas(12, 5.6)
    box(ax, 3, 62, 24, 14, "RULE ENGINE\nweighted, typed\nknown-bad patterns", TEAL, fs=9)
    box(ax, 3, 30, 24, 14, "UEBA\nIsolationForest\n+ peer comparison", TEAL, fs=9)
    box(ax, 36, 46, 26, 16, "RISK SCORE 0-100\nrules(cap 80) +\n0.25·UEBA + peer", BLUE, fs=9.5)
    arrow(ax, 27, 69, 36, 58); arrow(ax, 27, 37, 36, 52)
    for i, (lbl, col, tc) in enumerate([
            ("ALLOW  (score < 40)", GREEN, "white"),
            ("STEP-UP MFA  (40–69)", AMBER, "#1A1A19"),
            ("MAKER-CHECKER  (70–84)", ORANGE, "white"),
            ("BLOCK  (≥ 85)", RED, "white")]):
        box(ax, 72, 74 - i * 15, 26, 11, lbl, col, tc=tc, fs=9)
    arrow(ax, 62, 54, 72, 54)
    ax.text(50, 8, "Type-aware policy: negligence floored to maker-checker (never auto-blocked); malicious blocks; compromised steps up.",
            ha="center", color=GREY, fontsize=8.5, style="italic")
    save(fig, "scoring.png")


# ---------------------------------------------------------------- insider types
def insider_types():
    fig, ax = canvas(12, 6.4)
    cols = [
        ("MALICIOUS", RED, "white", "Dormant vendor · 2 AM ·\nunknown VPN → escalate →\nbulk-export 5000 records",
         "dormant reactivation,\nprivilege escalation, mass export,\nout-of-role, after-hours", "→ BLOCK  (100/100)"),
        ("COMPROMISED", BLUE, "white", "Normal admin account ·\nnew country + device ·\n6 actions in 90 seconds",
         "new geo, new device,\natypical hour, rapid-fire\n(inhuman pace)", "→ STEP-UP MFA"),
        ("NEGLIGENT", AMBER, "#1A1A19", "Active vendor · access\nexpired 18 days ago ·\nreports from personal laptop",
         "expired access in use,\nunmanaged personal device,\nsensitive data touched", "→ MAKER-CHECKER"),
    ]
    x = 3
    for name, col, tc, scen, sig, out in cols:
        w = 30
        box(ax, x, 84, w, 9, name, col, tc=tc, fs=11)
        box(ax, x, 60, w, 20, scen, "#F2F2F0", tc=INK, fs=8.3, bold=False, ec="#DDD")
        box(ax, x, 34, w, 22, sig, LIGHT, tc=INK, fs=8, bold=False, ec="#DDD")
        box(ax, x, 20, w, 10, out, col, tc=tc, fs=9.5)
        x += 33
    ax.text(50, 8, "Same rules + UEBA engine; the dominant rule category sets the insider type and its risk-based response.",
            ha="center", color=GREY, fontsize=8.5, style="italic")
    save(fig, "insider_types.png")


# ---------------------------------------------------------------- pqc vault
def pqc_vault():
    fig, ax = canvas(12, 4.6)
    box(ax, 3, 55, 20, 16, "Secret\n(privileged\ncredential)", "#F2F2F0", tc=INK, bold=False, ec="#DDD")
    box(ax, 30, 55, 24, 16, "AES-256-GCM\nkey = ML-KEM-768\nshared secret", BLUE, fs=9)
    box(ax, 62, 55, 34, 16, "ML-KEM-768 encapsulate\nagainst vault public key\n→ 32-byte shared secret", TEAL, fs=8.8)
    arrow(ax, 23, 63, 30, 63); arrow(ax, 62, 63, 54, 63)
    box(ax, 12, 22, 50, 14, "Store: ciphertext + nonce + KEM ciphertext", TEAL, fs=9)
    arrow(ax, 42, 55, 40, 36)
    box(ax, 66, 22, 30, 14, "get_secret():\nKEM decapsulate → decrypt", GREEN, fs=8.8)
    arrow(ax, 62, 29, 66, 29)
    ax.text(50, 8, "The AES key IS the ML-KEM shared secret → harvest-now-decrypt-later resistant.",
            ha="center", color=GREY, fontsize=8.5, style="italic")
    save(fig, "pqc_vault.png")


# ---------------------------------------------------------------- audit chain
def audit_chain():
    fig, ax = canvas(12, 4.6)
    box(ax, 2, 60, 14, 14, "GENESIS", GREY, fs=8.5)
    xs = [20, 44, 68]
    for i, x in enumerate(xs):
        box(ax, x, 58, 20, 18, f"Entry {i+1}\nhash(prev, ts,\nactor, action,\npayload)\n+ ML-DSA sig", TEAL, fs=7.6)
        arrow(ax, x - 4, 67, x, 67, TEAL)
    arrow(ax, 16, 67, 20, 67, TEAL)
    box(ax, 40, 30, 22, 12, "verify_chain()", BLUE, fs=9.5)
    arrow(ax, 78, 58, 55, 42, GREY)
    box(ax, 4, 30, 30, 12, "PASS\nlinkage + hash + signature ok", GREEN, fs=8.5)
    box(ax, 68, 30, 28, 12, "FAIL at first bad id\n(any entry edited)", RED, fs=8.5)
    arrow(ax, 40, 36, 34, 36, GREEN); arrow(ax, 62, 36, 68, 36, RED)
    ax.text(50, 8, "Editing any entry breaks its hash and every link after; the ML-DSA-65 signature must also verify — recomputing hashes is not enough.",
            ha="center", color=GREY, fontsize=8.2, style="italic")
    save(fig, "audit_chain.png")


# ---------------------------------------------------------------- live sequence
def live_sequence():
    fig, ax = canvas(12, 6.2)
    box(ax, 4, 84, 30, 10, "Employee performs action\n(resource, records)", GREY, fs=9)
    box(ax, 4, 66, 30, 10, "Live engine scores session\n+ candidate action", TEAL, fs=9)
    arrow(ax, 19, 84, 19, 76)
    box(ax, 4, 48, 30, 10, "decide(score, insider_type)", BLUE, fs=9.5)
    arrow(ax, 19, 66, 19, 58)
    outs = [
        ("ALLOW", GREEN, "white", "persist event\n(EXECUTED)", 4),
        ("STEP-UP MFA", AMBER, "#1A1A19", "MFA modal; on valid\ncode → same action\n(no stacking)", 28),
        ("MAKER-CHECKER", ORANGE, "white", "held for approval\n(not persisted)", 52),
        ("BLOCK", RED, "white", "log DENIED attempt,\nfreeze session, lock\naccount", 76),
    ]
    for lbl, col, tc, desc, x in outs:
        box(ax, x, 26, 22, 8, lbl, col, tc=tc, fs=9)
        box(ax, x, 8, 22, 14, desc, "#F2F2F0", tc=INK, fs=7.6, bold=False, ec="#DDD")
        arrow(ax, x + 11, 26, x + 11, 22, col)
    arrow(ax, 19, 48, 15, 34, BLUE)
    ax.text(85, 52, "broadcast\nactivity + alert\n(typed) → SOC\nWebSocket", ha="center", va="center",
            color=GREY, fontsize=8, style="italic")
    save(fig, "live_sequence.png")


if __name__ == "__main__":
    architecture(); datamodel(); scoring(); insider_types()
    pqc_vault(); audit_chain(); live_sequence(); bank_flow()
    print("all diagrams written to", OUT)
