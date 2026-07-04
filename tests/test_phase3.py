"""Phase 3 tests: attack trigger, adaptive response, WebSocket feed."""
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.api.routes as routes
from app.detection.response import decide, respond
from app.detection.score import assess
from app.detection.ueba import UebaModel
from app.models import entities
from app.models.db import Base
from app.models.entities import Alert
from app.simulator.attack import trigger_attack
from app.simulator.normal import seed_users, simulate_history


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    seed_users(session)
    simulate_history(session, days=14, seed=3, end=datetime(2026, 7, 3, 12, 0))
    yield session
    session.close()


def test_decide_thresholds():
    assert decide(10)[0] == "ALLOW"
    assert decide(50)[0] == "STEP_UP_MFA"
    assert decide(75)[0] == "MAKER_CHECKER"
    assert decide(90)[0] == "BLOCK"


def test_attack_gets_blocked_with_alert(db):
    model = UebaModel()
    model.train(db)
    sess = trigger_attack(db)
    assessment = assess(sess.user, sorted(sess.events, key=lambda e: e.timestamp), model)
    decision = respond(db, sess.user, sess, assessment)
    assert decision.action == "BLOCK"
    alert = db.get(Alert, decision.alert_id)
    assert alert.severity == "CRITICAL" and "dormant" in alert.message.lower()


def test_demo_attack_endpoint_and_websocket(db, monkeypatch):
    """Full loop: WS client connected, POST /demo/attack, receive score + alert frames."""
    from app.main import app

    monkeypatch.setattr(routes, "get_db", lambda: db)
    app.dependency_overrides[routes.get_db] = lambda: db
    routes._model = UebaModel()  # force retrain on this test DB
    client = TestClient(app)
    try:
        with client.websocket_connect("/ws/feed") as ws:
            r = client.post("/demo/attack")
            assert r.status_code == 200
            body = r.json()
            assert body["score"] >= 85 and body["action"] == "BLOCK"
            frame1 = ws.receive_json()
            frame2 = ws.receive_json()
            assert frame1["type"] == "score" and frame1["score"] >= 85
            assert frame2["type"] == "alert" and frame2["action"] == "BLOCK"
            assert any("5000" in x or "records" in x for x in frame2["reasons"])
        alerts = client.get("/alerts").json()
        assert alerts and alerts[0]["action_taken"] == "BLOCK"
    finally:
        app.dependency_overrides.clear()
        routes._model = UebaModel()
