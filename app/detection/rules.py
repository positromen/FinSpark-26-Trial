"""Rule engine: known-bad patterns for privileged-access misuse.

Each rule inspects a session's events (plus the acting user) and returns
`RuleHit(reason, weight)` when it fires. Weights feed the risk score.
"""
from dataclasses import dataclass

from app.models.entities import Event, User
from app.simulator.normal import RESOURCES_BY_ROLE

MASS_EXPORT_THRESHOLD = 1000
AFTER_HOURS = range(0, 5 + 1)  # 00:00-05:59


@dataclass
class RuleHit:
    rule: str
    reason: str
    weight: int


def evaluate(user: User, events: list[Event]) -> list[RuleHit]:
    """Run all rules over one session's events; return every hit."""
    hits: list[RuleHit] = []

    if user.is_dormant and any(e.action_type == "LOGIN" for e in events):
        hits.append(RuleHit(
            "DORMANT_REACTIVATION",
            f"Dormant {'vendor ' if user.is_vendor else ''}account '{user.username}' became active",
            30,
        ))

    priv = [e for e in events if e.action_type == "PRIV_CHANGE"]
    if priv:
        hits.append(RuleHit(
            "PRIVILEGE_ESCALATION",
            f"Privilege change on {priv[0].resource} outside normal grant process",
            25,
        ))

    night = [e for e in events if e.timestamp.hour in AFTER_HOURS and e.action_type != "LOGOUT"]
    if night:
        hits.append(RuleHit(
            "AFTER_HOURS_ACCESS",
            f"{len(night)} privileged action(s) between 00:00-06:00",
            20,
        ))

    exported = sum(e.records_touched for e in events if e.action_type in ("DB_QUERY", "DB_EXPORT"))
    if exported >= MASS_EXPORT_THRESHOLD:
        hits.append(RuleHit(
            "MASS_EXPORT",
            f"{exported} records touched in one session (threshold {MASS_EXPORT_THRESHOLD})",
            30,
        ))

    allowed = set(RESOURCES_BY_ROLE.get(user.role, [])) | {"pam-gateway"}
    foreign = {e.resource for e in events} - allowed
    if foreign:
        hits.append(RuleHit(
            "NO_BUSINESS_RELATIONSHIP",
            f"Access to resource(s) outside role '{user.role}': {', '.join(sorted(foreign))}",
            15,
        ))

    return hits
