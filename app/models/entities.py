"""ORM entities for Prahari."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.db import Base


class User(Base):
    """A privileged user (admin, DBA, contractor...)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32))  # DBA / SYSADMIN / NET_ADMIN / APP_ADMIN / CONTRACTOR
    is_dormant: Mapped[bool] = mapped_column(Boolean, default=False)
    is_vendor: Mapped[bool] = mapped_column(Boolean, default=False)

    events: Mapped[list["Event"]] = relationship(back_populates="user")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user")


class Session(Base):
    """One login-to-logout activity window for a user."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100, set in Phase 2
    risk_reasons: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON breakdown

    user: Mapped[User] = relationship(back_populates="sessions")
    events: Mapped[list["Event"]] = relationship(back_populates="session")


class Event(Base):
    """A single privileged action."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    session_id: Mapped[int | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    action_type: Mapped[str] = mapped_column(String(32))  # LOGIN/DB_QUERY/DB_EXPORT/CONFIG_CHANGE/PRIV_CHANGE/FILE_ACCESS/LOGOUT
    resource: Mapped[str] = mapped_column(String(128))
    records_touched: Mapped[int] = mapped_column(Integer, default=0)
    source_ip: Mapped[str] = mapped_column(String(45))
    geo: Mapped[str] = mapped_column(String(64))
    device: Mapped[str] = mapped_column(String(64))
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)

    user: Mapped[User] = relationship(back_populates="events")
    session: Mapped[Session | None] = relationship(back_populates="events")


class Alert(Base):
    """A detection alert raised for a session/user (Phase 2+)."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    session_id: Mapped[int | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    severity: Mapped[str] = mapped_column(String(16))  # INFO/WARNING/CRITICAL
    action_taken: Mapped[str] = mapped_column(String(32), default="NONE")  # ALLOW/STEP_UP_MFA/MAKER_CHECKER/BLOCK
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLogEntry(Base):
    """Hash-chained, PQC-signed audit record (signing lands in Phase 4)."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(64))
    payload: Mapped[str] = mapped_column(Text)
    prev_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    entry_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    signature: Mapped[str | None] = mapped_column(Text, nullable=True)


class VaultItem(Base):
    """PQC-wrapped credential (encryption lands in Phase 4)."""

    __tablename__ = "vault_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    ciphertext: Mapped[str] = mapped_column(Text)
    nonce: Mapped[str] = mapped_column(String(64))
    kem_ciphertext: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
