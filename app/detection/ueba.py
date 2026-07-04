"""UEBA: behavioural baseline per user/role using IsolationForest + peer comparison.

Feature vector per session:
  [login_hour, event_count, total_records, distinct_resources,
   config_changes, offsite_ip, new_device]
"""
from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session as OrmSession

from app.models.entities import Event, Session, User


def extract_features(events: list[Event], known_devices: set[str] | None = None) -> list[float]:
    """Build one feature vector from a session's events."""
    if not events:
        return [0.0] * 7
    login_hour = min(e.timestamp for e in events).hour
    total_records = sum(e.records_touched for e in events)
    resources = {e.resource for e in events}
    config_changes = sum(1 for e in events if e.action_type in ("CONFIG_CHANGE", "PRIV_CHANGE"))
    offsite = 0.0 if all(e.source_ip.startswith("10.20.") for e in events) else 1.0
    new_device = 0.0
    if known_devices is not None:
        new_device = 0.0 if {e.device for e in events} <= known_devices else 1.0
    return [float(login_hour), float(len(events)), float(total_records),
            float(len(resources)), float(config_changes), offsite, new_device]


@dataclass
class UebaResult:
    anomaly_score: float  # 0 (normal) - 100 (highly anomalous)
    peer_deviation: float  # how many x the same-role peer average records this session touched
    summary: str


class UebaModel:
    """IsolationForest trained on historical (normal) sessions."""

    def __init__(self) -> None:
        self._forest: IsolationForest | None = None
        self._baseline_scores: np.ndarray | None = None
        self.role_avg_records: dict[str, float] = {}
        self.user_devices: dict[int, set[str]] = {}

    @property
    def is_trained(self) -> bool:
        return self._forest is not None

    def train(self, db: OrmSession) -> int:
        """Fit on all closed historical sessions. Returns number of training rows."""
        rows: list[list[float]] = []
        role_records: dict[str, list[float]] = {}
        # Baseline = closed historical sessions only; never live or blocked ones.
        for sess in db.query(Session).filter(Session.status == "CLOSED").all():
            events = sorted(sess.events, key=lambda e: e.timestamp)
            if not events:
                continue
            user = sess.user
            self.user_devices.setdefault(user.id, set()).update(e.device for e in events)
            # Train on cumulative prefixes as well as the full session, so live
            # sessions (which arrive one action at a time) are in-distribution and
            # normal early activity doesn't look anomalous just for being short.
            for k in range(1, len(events) + 1):
                rows.append(extract_features(events[:k], self.user_devices[user.id]))
            role_records.setdefault(user.role, []).append(
                float(sum(e.records_touched for e in events)))
        if not rows:
            raise ValueError("no historical sessions to train on — run the seeder first")
        X = np.array(rows)
        self._forest = IsolationForest(n_estimators=100, contamination="auto", random_state=42)
        self._forest.fit(X)
        self._baseline_scores = self._forest.score_samples(X)
        self.role_avg_records = {r: (sum(v) / len(v)) for r, v in role_records.items()}
        return len(rows)

    def score_session(self, user: User, events: list[Event]) -> UebaResult:
        """Anomaly-score one session against the trained baseline."""
        if not self.is_trained:
            raise RuntimeError("UEBA model not trained")
        feats = extract_features(events, self.user_devices.get(user.id, set()))
        raw = float(self._forest.score_samples(np.array([feats]))[0])
        # Map: at/above baseline median -> ~0; at/below baseline 1st percentile -> ~100
        med = float(np.median(self._baseline_scores))
        p1 = float(np.percentile(self._baseline_scores, 1))
        span = max(med - p1, 1e-6)
        anomaly = float(np.clip((med - raw) / span, 0.0, 1.0) * 100.0)

        peer_avg = self.role_avg_records.get(user.role) or 1.0
        session_records = float(sum(e.records_touched for e in events))
        peer_dev = session_records / max(peer_avg, 1.0)

        parts = [f"behaviour anomaly {anomaly:.0f}/100 vs baseline"]
        if peer_dev >= 3:
            parts.append(f"touched {peer_dev:.0f}x more records than {user.role} peers")
        return UebaResult(anomaly, peer_dev, "; ".join(parts))
