"""Prahari — privileged-access insider-threat detection platform (FinSpark'26)."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router
from app.config import settings
from app.models.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, description="Insider-threat detection for banks",
              lifespan=lifespan)
app.include_router(router)


@app.get("/health")
def health() -> dict:
    """Liveness check."""
    return {"status": "ok", "app": settings.app_name}
