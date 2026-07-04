"""REST + WebSocket endpoints for users, sessions, scoring, and the demo attack."""
from fastapi import APIRouter, Depends, HTTPException, WebSocket
from sqlalchemy.orm import Session as OrmSession

from pydantic import BaseModel

from app.api.ws import feed_endpoint, manager
from app.detection.response import respond
from app.detection.score import assess
from app.detection.ueba import UebaModel
from app.models.db import SessionLocal
from app.models.entities import Alert, AuditLogEntry, Session, User
from app.security import audit, pqc, vault
from app.simulator.attack import trigger_attack

router = APIRouter()
_model = UebaModel()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_model(db: OrmSession) -> UebaModel:
    """Lazy-train the shared UEBA model on first use."""
    if not _model.is_trained:
        _model.train(db)
    return _model


@router.get("/users")
def list_users(db: OrmSession = Depends(get_db)) -> list[dict]:
    return [{"id": u.id, "username": u.username, "name": u.name, "role": u.role,
             "is_dormant": u.is_dormant, "is_vendor": u.is_vendor}
            for u in db.query(User).all()]


@router.get("/sessions/{session_id}/score")
def score_session(session_id: int, db: OrmSession = Depends(get_db)) -> dict:
    sess = db.get(Session, session_id)
    if sess is None:
        raise HTTPException(404, "session not found")
    events = sorted(sess.events, key=lambda e: e.timestamp)
    result = assess(sess.user, events, get_model(db))
    return {"session_id": session_id, "user": sess.user.username, **result.as_dict()}


@router.get("/alerts")
def list_alerts(limit: int = 50, db: OrmSession = Depends(get_db)) -> list[dict]:
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(limit).all()
    return [{"id": a.id, "user_id": a.user_id, "session_id": a.session_id,
             "severity": a.severity, "action_taken": a.action_taken,
             "message": a.message, "created_at": a.created_at.isoformat()}
            for a in alerts]


@router.post("/demo/attack")
async def demo_attack(db: OrmSession = Depends(get_db)) -> dict:
    """Trigger the 2 AM insider attack: detect, score, respond, and broadcast live."""
    model = get_model(db)  # train on clean history BEFORE injecting the attack
    sess = trigger_attack(db)
    events = sorted(sess.events, key=lambda e: e.timestamp)
    assessment = assess(sess.user, events, model)
    sess.risk_score = assessment.score
    decision = respond(db, sess.user, sess, assessment)
    db.commit()
    audit.append_entry(db, actor="prahari-engine", action="THREAT_DETECTED",
                       payload=f"user={sess.user.username} session={sess.id} "
                               f"score={assessment.score:.0f} action={decision.action}")

    payload = {
        "type": "attack_detected",
        "session_id": sess.id,
        "user": sess.user.username,
        "score": round(assessment.score, 1),
        "action": decision.action,
        "severity": decision.severity,
        "reasons": assessment.reasons,
        "events": [{"t": e.timestamp.isoformat(), "action": e.action_type,
                    "resource": e.resource, "records": e.records_touched}
                   for e in events],
    }
    await manager.broadcast({"type": "score", "user": sess.user.username,
                             "session_id": sess.id, "score": payload["score"]})
    await manager.broadcast({**payload, "type": "alert"})
    return payload


@router.websocket("/ws/feed")
async def ws_feed(ws: WebSocket) -> None:
    await feed_endpoint(ws)


# --- Dashboard data (Phase 5) ---

@router.get("/dashboard/overview")
def dashboard_overview(db: OrmSession = Depends(get_db)) -> dict:
    """Everything the SOC dashboard needs on load: users, scored sessions, heatmap."""
    import json

    model = get_model(db)
    sessions = (db.query(Session).filter(Session.ended_at != None)  # noqa: E711
                .order_by(Session.started_at).all())
    for sess in sessions:  # score-and-persist any session not yet assessed
        if sess.risk_reasons is None:
            events = sorted(sess.events, key=lambda e: e.timestamp)
            a = assess(sess.user, events, model)
            sess.risk_score = a.score
            sess.risk_reasons = json.dumps(a.reasons)
    db.commit()

    dates = sorted({s.started_at.date() for s in sessions})[-7:]
    users = db.query(User).all()
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
        "latest_score": round(recent[-1].risk_score, 1) if recent else 0,
    }


@router.get("/sessions/{session_id}/events")
def session_events(session_id: int, db: OrmSession = Depends(get_db)) -> list[dict]:
    sess = db.get(Session, session_id)
    if sess is None:
        raise HTTPException(404, "session not found")
    return [{"t": e.timestamp.isoformat(), "action": e.action_type, "resource": e.resource,
             "records": e.records_touched, "ip": e.source_ip, "device": e.device}
            for e in sorted(sess.events, key=lambda e: e.timestamp)]


# --- Post-quantum security layer (Phase 4) ---

class SecretIn(BaseModel):
    name: str
    secret: str


@router.get("/pqc/info")
def pqc_info() -> dict:
    return {"provider": pqc.PROVIDER, "kem": pqc.KEM_ALG, "signature": pqc.SIG_ALG}


@router.post("/vault/secrets")
def vault_store(body: SecretIn, db: OrmSession = Depends(get_db)) -> dict:
    item = vault.store_secret(db, body.name, body.secret)
    audit.append_entry(db, actor="vault", action="SECRET_STORED", payload=f"name={body.name}")
    return {"name": item.name, "kem": pqc.KEM_ALG, "stored": True}


@router.get("/vault/secrets/{name}")
def vault_get(name: str, db: OrmSession = Depends(get_db)) -> dict:
    try:
        secret = vault.get_secret(db, name)
    except KeyError:
        raise HTTPException(404, f"no vault item named '{name}'")
    audit.append_entry(db, actor="vault", action="SECRET_ACCESSED", payload=f"name={name}")
    return {"name": name, "secret": secret}


@router.get("/audit")
def audit_list(limit: int = 100, db: OrmSession = Depends(get_db)) -> list[dict]:
    entries = db.query(AuditLogEntry).order_by(AuditLogEntry.id.desc()).limit(limit).all()
    return [{"id": e.id, "timestamp": e.timestamp.isoformat(), "actor": e.actor,
             "action": e.action, "payload": e.payload, "prev_hash": e.prev_hash,
             "entry_hash": e.entry_hash} for e in entries]


@router.get("/audit/verify")
def audit_verify(db: OrmSession = Depends(get_db)) -> dict:
    report = audit.verify_chain(db)
    return {"ok": report.ok, "entries_checked": report.entries_checked,
            "first_bad_id": report.first_bad_id, "problem": report.problem,
            "signature_alg": pqc.SIG_ALG}


@router.post("/demo/tamper")
async def demo_tamper(db: OrmSession = Depends(get_db)) -> dict:
    """Maliciously edit one audit entry, then re-verify — the chain must FAIL."""
    entry = db.query(AuditLogEntry).order_by(AuditLogEntry.id).first()
    if entry is None:
        raise HTTPException(400, "audit log is empty — trigger the attack first")
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
