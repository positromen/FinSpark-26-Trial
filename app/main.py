"""Prahari — privileged-access insider-threat detection platform (FinSpark'26)."""
from fastapi import FastAPI

from app.config import settings

app = FastAPI(title=settings.app_name, description="Insider-threat detection for banks")


@app.get("/health")
def health() -> dict:
    """Liveness check."""
    return {"status": "ok", "app": settings.app_name}
