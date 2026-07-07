"""REST + WebSocket API: auth, employee portal, SOC console, PQC layer."""
import json

from fastapi import APIRouter, Depends, HTTPException, WebSocket
from pydantic import BaseModel
from sqlalchemy.orm import Session as OrmSession

from app.api.ws import feed_endpoint, manager
from app.config import settings
from app.detection import live
from app.detection.response import respond
from app.detection.rules import dominant_insider_type, evaluate
from app.detection.score import assess
from app.detection.ueba import UebaModel
from app.models.entities import Alert, AuditLogEntry, Session, SessionCommand, User
from app.pam import access_review
from app.security import audit, pqc, vault
from app.security.auth import (create_token, current_user, get_db, require_analyst,
                               verify_password)
from app.simulator.attack import (trigger_compromised, trigger_malicious,
                                   trigger_negligent)
from app.simulator.normal import RESOURCES_BY_ROLE

SCENARIOS = {"malicious": trigger_malicious, "compromised": trigger_compromised,
             "negligent": trigger_negligent}

router = APIRouter()
_model = UebaModel()

ALL_RESOURCES = [{"name": r, "owner_role": role}
                 for role, rs in RESOURCES_BY_ROLE.items() for r in rs]


def get_model(db: OrmSession) -> UebaModel:
    """Lazy-train the shared UEBA model on first use."""
    if not _model.is_trained:
        _model.train(db)
    return _model


def _login_identity(user: User) -> tuple[str, str, str]:
    """Connection profile for a login. A dormant/vendor account inherently comes
    from an untrusted context (this is what makes the attack realistic)."""
    if user.is_dormant or user.is_vendor:
        return "103.94.55.7", "Unknown (VPN exit)", "LAPTOP-UNREG"
    return f"10.20.{10 + user.id}.11", "Pune, IN", f"WKS-{user.username.upper()}"


async def _broadcast_activity(user: User, sess: Session, outcome: live.ActionOutcome,
                              action: str, resource: str) -> None:
    await manager.broadcast({
        "type": "activity",
        "session_id": sess.id, "user": user.username, "name": user.name,
        "role": user.role, "action": action, "resource": resource,
        "score": round(outcome.score, 1), "decision": outcome.decision,
        "allowed": outcome.allowed, "status": outcome.session_status,
        "insider_type": outcome.insider_type, "reasons": outcome.reasons,
    })
    if outcome.decision != "ALLOW":
        await manager.broadcast({
            "type": "alert", "session_id": sess.id, "user": user.username,
            "role": user.role, "severity": outcome.severity, "action": outcome.decision,
            "insider_type": outcome.insider_type,
            "score": round(outcome.score, 1), "reasons": outcome.reasons,
        })


# ======================= AUTH =======================

class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
def login(body: LoginIn, db: OrmSession = Depends(get_db)) -> dict:
    user = db.query(User).filter_by(username=body.username).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "invalid username or password")
    return {"token": create_token(user), "user": {
        "username": user.username, "name": user.name, "role": user.role,
        "account_type": user.account_type, "is_dormant": user.is_dormant,
        "is_vendor": user.is_vendor}}


@router.get("/auth/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"username": user.username, "name": user.name, "role": user.role,
            "account_type": user.account_type}


# ======================= EMPLOYEE PORTAL =======================

class ActionIn(BaseModel):
    action: str
    resource: str
    records: int | None = None
    mfa_code: str | None = None


def _employee(user: User = Depends(current_user)) -> User:
    if user.account_type != "EMPLOYEE":
        raise HTTPException(403, "employee account required for the portal")
    return user


def _session_state(sess: Session) -> dict:
    return {"id": sess.id, "status": sess.status, "score": round(sess.risk_score, 1),
            "started_at": sess.started_at.isoformat(), "source_ip": sess.source_ip,
            "geo": sess.geo, "device": sess.device,
            "reasons": json.loads(sess.risk_reasons or "[]"),
            "events": [{"t": e.timestamp.isoformat(), "action": e.action_type,
                        "resource": e.resource, "records": e.records_touched}
                       for e in sorted(sess.events, key=lambda e: e.timestamp)]}


async def _broadcast_presence(user: User, sess: Session, event: str) -> None:
    """Tell every connected SOC console that the live-session set changed."""
    await manager.broadcast({
        "type": "presence", "event": event, "session_id": sess.id,
        "user": user.username, "role": user.role, "status": sess.status,
        "score": round(sess.risk_score, 1),
    })


@router.post("/portal/bootstrap")
async def portal_bootstrap(user: User = Depends(_employee),
                           db: OrmSession = Depends(get_db)) -> dict:
    """Open the employee's live session and return everything the portal needs."""
    get_model(db)  # ensure baseline trained before any live scoring
    ip, geo, device = _login_identity(user)
    sess = live.open_session(db, user, ip, geo, device)
    await _broadcast_presence(user, sess, "login")  # SOC sees the session appear instantly
    return {
        "user": {"username": user.username, "name": user.name, "role": user.role,
                 "is_vendor": user.is_vendor, "is_dormant": user.is_dormant},
        "session": _session_state(sess),
        "my_resources": RESOURCES_BY_ROLE.get(user.role, []),
        "all_resources": ALL_RESOURCES,
        "catalog": live.ACTION_CATALOG,
    }


@router.get("/portal/session")
def portal_session(user: User = Depends(_employee), db: OrmSession = Depends(get_db)) -> dict:
    """Current live-session state — polled by the portal so its gauge/log stay live."""
    sess = (db.query(Session)
            .filter(Session.user_id == user.id, Session.status.in_(["ACTIVE", "BLOCKED"]))
            .order_by(Session.id.desc()).first())
    return {"session": _session_state(sess)} if sess else {"session": None}


@router.post("/portal/action")
async def portal_action(body: ActionIn, user: User = Depends(_employee),
                        db: OrmSession = Depends(get_db)) -> dict:
    if body.action not in live.ACTION_CATALOG:
        raise HTTPException(400, f"unknown action '{body.action}'")
    ip, geo, device = _login_identity(user)
    sess = live.open_session(db, user, ip, geo, device)  # reuses active / stays-locked if blocked

    records = body.records if body.records is not None \
        else live.ACTION_CATALOG[body.action]["default_records"]
    mfa_ok = bool(body.mfa_code) and body.mfa_code == settings.mfa_code

    outcome = live.perform_action(db, get_model(db), sess, user, body.action,
                                  body.resource, records, mfa_ok=mfa_ok)
    if not outcome.allowed and outcome.decision == "BLOCK":
        audit.append_entry(db, actor="prahari-engine", action="THREAT_BLOCKED",
                           payload=f"user={user.username} session={sess.id} "
                                   f"score={outcome.score:.0f} attempted={body.action}:{body.resource}")
    await _broadcast_activity(user, sess, outcome, body.action, body.resource)
    return {"allowed": outcome.allowed, "decision": outcome.decision,
            "severity": outcome.severity, "score": round(outcome.score, 1),
            "message": outcome.message, "reasons": outcome.reasons,
            "session": _session_state(sess)}


@router.post("/portal/logout")
async def portal_logout(user: User = Depends(_employee), db: OrmSession = Depends(get_db)) -> dict:
    sess = (db.query(Session)
            .filter(Session.user_id == user.id, Session.status == "ACTIVE")
            .order_by(Session.id.desc()).first())
    if sess:
        live.close_session(db, sess)
        await _broadcast_presence(user, sess, "logout")
    return {"ok": True}


# ======================= SOC CONSOLE (analyst only) =======================

@router.get("/soc/overview")
def soc_overview(user: User = Depends(require_analyst),
                 db: OrmSession = Depends(get_db)) -> dict:
    """Dashboard load: users, scored historical sessions, heatmap, live sessions."""
    model = get_model(db)
    sessions = (db.query(Session).filter(Session.status == "CLOSED")
                .order_by(Session.started_at).all())
    for sess in sessions:
        if sess.risk_reasons is None:
            a = assess(sess.user, sorted(sess.events, key=lambda e: e.timestamp), model)
            sess.risk_score = a.score
            sess.risk_reasons = json.dumps(a.reasons)
    db.commit()

    dates = sorted({s.started_at.date() for s in sessions})[-7:]
    users = db.query(User).filter(User.account_type == "EMPLOYEE").all()
    heatmap = []
    for u in users:
        cells = []
        for d in dates:
            day = [s.risk_score for s in sessions
                   if s.user_id == u.id and s.started_at.date() == d]
            cells.append(round(max(day), 1) if day else None)
        heatmap.append({"user": u.username, "role": u.role, "cells": cells})

    recent = sessions[-30:]
    return {
        "users": [{"id": u.id, "username": u.username, "name": u.name, "role": u.role,
                   "is_dormant": u.is_dormant, "is_vendor": u.is_vendor} for u in users],
        "sessions": [{"id": s.id, "user": s.user.username, "role": s.user.role,
                      "started_at": s.started_at.isoformat(),
                      "score": round(s.risk_score, 1),
                      "reasons": json.loads(s.risk_reasons or "[]")}
                     for s in reversed(recent)],
        "heatmap": {"dates": [d.isoformat() for d in dates], "rows": heatmap},
        "live_sessions": _live_sessions(db),
    }


def _live_sessions(db: OrmSession) -> list[dict]:
    rows = (db.query(Session).filter(Session.status.in_(["ACTIVE", "BLOCKED"]))
            .order_by(Session.id.desc()).all())
    out = []
    for s in rows:
        evs = sorted(s.events, key=lambda e: e.timestamp)
        out.append({
            "id": s.id, "user": s.user.username, "name": s.user.name, "role": s.user.role,
            "status": s.status, "score": round(s.risk_score, 1),
            "insider_type": dominant_insider_type(evaluate(s.user, evs)),
            "source_ip": s.source_ip, "geo": s.geo, "device": s.device,
            "started_at": s.started_at.isoformat(),
            "reasons": json.loads(s.risk_reasons or "[]"),
            "events": [{"t": e.timestamp.isoformat(), "action": e.action_type,
                        "resource": e.resource, "records": e.records_touched,
                        "ip": e.source_ip, "device": e.device} for e in evs]})
    return out


@router.get("/soc/live")
def soc_live(user: User = Depends(require_analyst), db: OrmSession = Depends(get_db)) -> list[dict]:
    return _live_sessions(db)


@router.get("/soc/alerts")
def soc_alerts(limit: int = 50, user: User = Depends(require_analyst),
               db: OrmSession = Depends(get_db)) -> list[dict]:
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(limit).all()
    return [{"id": a.id, "user_id": a.user_id, "session_id": a.session_id,
             "severity": a.severity, "action_taken": a.action_taken,
             "insider_type": a.insider_type,
             "message": a.message, "created_at": a.created_at.isoformat()} for a in alerts]


@router.get("/soc/access-review")
def soc_access_review(user: User = Depends(require_analyst),
                      db: OrmSession = Depends(get_db)) -> list[dict]:
    """PAM access-review table: privileged accounts flagged dormant / vendor / expired."""
    return access_review(db)


@router.get("/soc/sessions/{session_id}/commands")
def soc_session_commands(session_id: int, user: User = Depends(require_analyst),
                         db: OrmSession = Depends(get_db)) -> dict:
    """Privileged-session recording: the replayable command trail of a session."""
    sess = db.get(Session, session_id)
    if sess is None:
        raise HTTPException(404, "session not found")
    cmds = (db.query(SessionCommand).filter_by(session_id=session_id)
            .order_by(SessionCommand.timestamp, SessionCommand.id).all())
    return {"session_id": session_id, "user": sess.user.username,
            "role": sess.user.role, "status": sess.status,
            "source_ip": sess.source_ip, "device": sess.device, "geo": sess.geo,
            "commands": [{"t": c.timestamp.isoformat(), "command": c.command,
                          "action": c.action_type, "resource": c.resource,
                          "outcome": c.outcome} for c in cmds]}


@router.post("/soc/sessions/{session_id}/approve")
def soc_approve(session_id: int, user: User = Depends(require_analyst),
                db: OrmSession = Depends(get_db)) -> dict:
    """Maker-checker: an analyst approves a held session (records the decision)."""
    sess = db.get(Session, session_id)
    if sess is None:
        raise HTTPException(404, "session not found")
    audit.append_entry(db, actor=user.username, action="MAKER_CHECKER_APPROVED",
                       payload=f"session={session_id} user={sess.user.username}")
    return {"ok": True, "session_id": session_id, "approved_by": user.username}


@router.get("/soc/sessions/{session_id}/events")
def soc_session_events(session_id: int, user: User = Depends(require_analyst),
                       db: OrmSession = Depends(get_db)) -> list[dict]:
    sess = db.get(Session, session_id)
    if sess is None:
        raise HTTPException(404, "session not found")
    return [{"t": e.timestamp.isoformat(), "action": e.action_type, "resource": e.resource,
             "records": e.records_touched, "ip": e.source_ip, "device": e.device}
            for e in sorted(sess.events, key=lambda e: e.timestamp)]


async def _run_scenario(db: OrmSession, kind: str) -> dict:
    model = get_model(db)  # train on clean history BEFORE injecting the scenario
    sess = SCENARIOS[kind](db)
    events = sorted(sess.events, key=lambda e: e.timestamp)
    assessment = assess(sess.user, events, model)
    sess.risk_score = assessment.score
    sess.risk_reasons = json.dumps(assessment.reasons)
    decision = respond(db, sess.user, sess, assessment)
    db.commit()
    audit.append_entry(db, actor="prahari-engine", action="THREAT_DETECTED",
                       payload=f"user={sess.user.username} session={sess.id} "
                               f"type={assessment.insider_type} score={assessment.score:.0f} "
                               f"action={decision.action}")
    payload = {"scenario": kind, "session_id": sess.id, "user": sess.user.username,
               "role": sess.user.role, "insider_type": assessment.insider_type,
               "score": round(assessment.score, 1), "action": decision.action,
               "severity": decision.severity, "reasons": assessment.reasons}
    await manager.broadcast({"type": "alert", **payload})
    return payload


@router.post("/demo/scenario/{kind}")
async def demo_scenario(kind: str, user: User = Depends(require_analyst),
                        db: OrmSession = Depends(get_db)) -> dict:
    """Inject one scripted insider scenario: malicious / compromised / negligent."""
    if kind not in SCENARIOS:
        raise HTTPException(400, f"unknown scenario '{kind}'")
    return await _run_scenario(db, kind)


@router.post("/demo/attack")
async def demo_attack(user: User = Depends(require_analyst),
                      db: OrmSession = Depends(get_db)) -> dict:
    """Backwards-compatible alias for the malicious scenario."""
    return await _run_scenario(db, "malicious")


@router.websocket("/ws/feed")
async def ws_feed(ws: WebSocket) -> None:
    await feed_endpoint(ws)


# ======================= POST-QUANTUM SECURITY =======================

class SecretIn(BaseModel):
    name: str
    secret: str


@router.get("/pqc/info")
def pqc_info() -> dict:
    return {"provider": pqc.PROVIDER, "kem": pqc.KEM_ALG, "signature": pqc.SIG_ALG}


@router.post("/vault/secrets")
def vault_store(body: SecretIn, user: User = Depends(require_analyst),
                db: OrmSession = Depends(get_db)) -> dict:
    vault.store_secret(db, body.name, body.secret)
    audit.append_entry(db, actor=user.username, action="SECRET_STORED", payload=f"name={body.name}")
    return {"name": body.name, "kem": pqc.KEM_ALG, "stored": True}


@router.get("/vault/secrets/{name}")
def vault_get(name: str, user: User = Depends(require_analyst),
              db: OrmSession = Depends(get_db)) -> dict:
    try:
        secret = vault.get_secret(db, name)
    except KeyError:
        raise HTTPException(404, f"no vault item named '{name}'")
    audit.append_entry(db, actor=user.username, action="SECRET_ACCESSED", payload=f"name={name}")
    return {"name": name, "secret": secret}


@router.get("/audit")
def audit_list(limit: int = 100, user: User = Depends(require_analyst),
               db: OrmSession = Depends(get_db)) -> list[dict]:
    entries = db.query(AuditLogEntry).order_by(AuditLogEntry.id.desc()).limit(limit).all()
    return [{"id": e.id, "timestamp": e.timestamp.isoformat(), "actor": e.actor,
             "action": e.action, "payload": e.payload, "prev_hash": e.prev_hash,
             "entry_hash": e.entry_hash} for e in entries]


@router.get("/audit/verify")
def audit_verify(user: User = Depends(require_analyst),
                 db: OrmSession = Depends(get_db)) -> dict:
    report = audit.verify_chain(db)
    return {"ok": report.ok, "entries_checked": report.entries_checked,
            "first_bad_id": report.first_bad_id, "problem": report.problem,
            "signature_alg": pqc.SIG_ALG}


@router.post("/demo/tamper")
async def demo_tamper(user: User = Depends(require_analyst),
                      db: OrmSession = Depends(get_db)) -> dict:
    """Maliciously edit one audit entry, then re-verify — the chain must FAIL."""
    entry = db.query(AuditLogEntry).order_by(AuditLogEntry.id).first()
    if entry is None:
        raise HTTPException(400, "audit log is empty — run some activity first")
    original = entry.payload
    entry.payload = original.replace("BLOCK", "ALLOW") if "BLOCK" in original \
        else original + " [EDITED]"
    db.commit()
    report = audit.verify_chain(db)
    result = {"tampered_entry_id": entry.id, "original_payload": original,
              "tampered_payload": entry.payload, "chain_ok": report.ok,
              "problem": report.problem, "first_bad_id": report.first_bad_id}
    await manager.broadcast({"type": "audit_tamper", **result})
    return result
