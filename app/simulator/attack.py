"""The demo attack scenario.

At "2 AM", the dormant vendor contractor account wakes up, escalates its
privileges on the core banking DB, and bulk-exports 5000 customer records.
One call creates the whole session.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session as OrmSession

from app.models.entities import Event, Session, User

ATTACK_IP = "103.94.55.7"
ATTACK_GEO = "Unknown (VPN exit)"
ATTACK_DEVICE = "LAPTOP-UNREG"


def trigger_attack(db: OrmSession) -> Session:
    """Create the malicious 2 AM session for the dormant vendor. Returns the session."""
    vendor = db.query(User).filter_by(is_dormant=True, is_vendor=True).first()
    if vendor is None:
        raise ValueError("no dormant vendor account found — run the seeder first")

    # Anchor at 02:00 today so the after-hours rule fires regardless of demo time.
    t0 = datetime.now().replace(hour=2, minute=0, second=0, microsecond=0)
    sess = Session(user_id=vendor.id, started_at=t0)
    db.add(sess)
    db.flush()

    common = dict(user_id=vendor.id, session_id=sess.id, source_ip=ATTACK_IP,
                  geo=ATTACK_GEO, device=ATTACK_DEVICE)
    steps = [
        (0, "LOGIN", "pam-gateway", 0),
        (2, "PRIV_CHANGE", "core-banking-db", 0),
        (5, "DB_QUERY", "core-banking-db", 300),
        (9, "DB_EXPORT", "core-banking-db", 5000),
    ]
    for minutes, action, resource, records in steps:
        db.add(Event(action_type=action, resource=resource, records_touched=records,
                     timestamp=t0 + timedelta(minutes=minutes), **common))
    sess.ended_at = t0 + timedelta(minutes=10)
    db.commit()
    return sess
