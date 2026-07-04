"""Risk scoring engine: combine rule hits + UEBA anomaly into one 0-100 score."""
from dataclasses import dataclass, field

from app.detection.rules import RuleHit, evaluate
from app.detection.ueba import UebaModel
from app.models.entities import Event, User

# Contribution caps so neither side alone saturates the scale dishonestly
RULE_CAP = 65
UEBA_WEIGHT = 0.35  # up to 35 points from behavioural anomaly
PEER_BONUS = 10  # extra if wildly above same-role peers


@dataclass
class RiskAssessment:
    score: float  # 0-100
    rule_hits: list[RuleHit] = field(default_factory=list)
    ueba_summary: str = ""
    reasons: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "score": round(self.score, 1),
            "reasons": self.reasons,
            "rules": [{"rule": h.rule, "reason": h.reason, "weight": h.weight}
                      for h in self.rule_hits],
            "ueba": self.ueba_summary,
        }


def assess(user: User, events: list[Event], model: UebaModel) -> RiskAssessment:
    """Score one session 0-100 with a human-readable breakdown."""
    hits = evaluate(user, events)
    ueba = model.score_session(user, events)

    rule_points = min(sum(h.weight for h in hits), RULE_CAP)
    ueba_points = ueba.anomaly_score * UEBA_WEIGHT
    peer_points = PEER_BONUS if ueba.peer_deviation >= 5 else 0.0

    score = min(rule_points + ueba_points + peer_points, 100.0)

    reasons = [h.reason for h in hits]
    reasons.append(ueba.summary)
    if peer_points:
        reasons.append(f"far above {user.role} peer group (x{ueba.peer_deviation:.0f})")

    return RiskAssessment(score=score, rule_hits=hits, ueba_summary=ueba.summary,
                          reasons=reasons)
