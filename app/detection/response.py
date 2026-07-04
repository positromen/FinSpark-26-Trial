"""Adaptive access control: map a risk score to an enforcement action + Alert."""
from dataclasses import dataclass

from sqlalchemy.orm import Session as OrmSession

from app.detection.score import RiskAssessment
from app.models.entities import Alert, Session, User

# score thresholds (inclusive lower bounds)
THRESHOLDS = [
    (85, "BLOCK", "CRITICAL"),
    (70, "MAKER_CHECKER", "CRITICAL"),
    (40, "STEP_UP_MFA", "WARNING"),
    (0, "ALLOW", "INFO"),
]


@dataclass
class ResponseDecision:
    action: str
    severity: str
    alert_id: int | None


def decide(score: float) -> tuple[str, str]:
    """Return (action, severity) for a 0-100 risk score."""
    for floor, action, severity in THRESHOLDS:
        if score >= floor:
            return action, severity
    return "ALLOW", "INFO"


def respond(db: OrmSession, user: User, session: Session,
            assessment: RiskAssessment) -> ResponseDecision:
    """Apply the adaptive-response policy and persist an Alert (except plain ALLOW)."""
    action, severity = decide(assessment.score)
    alert_id = None
    if action != "ALLOW":
        alert = Alert(
            user_id=user.id,
            session_id=session.id,
            severity=severity,
            action_taken=action,
            message=(f"Risk {assessment.score:.0f}/100 for '{user.username}' -> {action}. "
                     + " | ".join(assessment.reasons)),
        )
        db.add(alert)
        db.commit()
        alert_id = alert.id
    return ResponseDecision(action=action, severity=severity, alert_id=alert_id)
