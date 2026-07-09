"""Prahari — privileged-access insider-threat detection platform (FinSpark'26)."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import settings
from app.models.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Ensure the customer-banking tables have data even on a pre-existing DB.
    from app.bank import seed_bank
    from app.models.db import SessionLocal
    db = SessionLocal()
    try:
        seed_bank(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, description="Insider-threat detection for banks",
              lifespan=lifespan)
app.include_router(router)

@app.get("/health")
def health() -> dict:
    """Liveness check."""
    return {"status": "ok", "app": settings.app_name}


# Serve the built SOC dashboard when it exists (frontend/dist), fully offline.
# Mounted last so API routes always win over the catch-all static handler.
_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="dashboard")
