"""REST + WebSocket endpoints for users, sessions, scoring, and the demo attack."""
from fastapi import APIRouter, Depends, HTTPException, WebSocket
from sqlalchemy.orm import Session as OrmSession

from app.api.ws import feed_endpoint, manager
from app.detection.response import respond
from app.detection.score import assess
from app.detection.ueba import UebaModel
from app.models.db import SessionLocal
from app.models.entities import Alert, Session, User
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
