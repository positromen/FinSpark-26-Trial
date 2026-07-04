"""REST endpoints for users, sessions, and risk scoring."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.detection.score import assess
from app.detection.ueba import UebaModel
from app.models.db import SessionLocal
from app.models.entities import Session, User

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
