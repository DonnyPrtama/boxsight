from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth as auth_api
from app.api import dashboard as dashboard_api
from app.api import deteksi as deteksi_api
from app.api import riwayat as riwayat_api
from app.api import settings as settings_api
from app.api import users as users_api
from app.core.config import get_settings
from app.db import models  # noqa: F401  dipakai agar tabel terdaftar di metadata
from app.db.base import Base
from app.db.seed import seed_all
from app.db.session import SessionLocal, engine
from app.services import inference

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        seed_all(db)
    if settings.inference_backend == "yolo":
        inference.ensure_model_ready()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(f"{settings.api_prefix}/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_api.router, prefix=settings.api_prefix)
app.include_router(settings_api.router, prefix=settings.api_prefix)
app.include_router(deteksi_api.router, prefix=settings.api_prefix)
app.include_router(deteksi_api.files_router, prefix=settings.api_prefix)
app.include_router(riwayat_api.router, prefix=settings.api_prefix)
app.include_router(users_api.router, prefix=settings.api_prefix)
app.include_router(dashboard_api.router, prefix=settings.api_prefix)
