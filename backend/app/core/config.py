from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Konfigurasi runtime. Nilai dibaca dari environment atau `.env` di folder backend."""

    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "BoxSight API"
    api_prefix: str = "/api"

    # Wajib. Aplikasi menolak start kalau kosong, lihat get_settings().
    jwt_secret: str = Field(min_length=32)
    jwt_ttl_minutes: int = 30

    db_url: str
    storage_dir: Path = API_DIR / "storage" / "images"
    max_upload_bytes: int = 5 * 1024 * 1024
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    inference_backend: Literal["stub", "yolo"] = "yolo"
    model_path: Path = API_DIR.parent / "model" / "weights" / "best.pt"

    # Seed untuk stub inferensi supaya hasil bisa direproduksi.
    stub_seed: str = "boxsight-stub"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        missing = [str(error["loc"][0]) for error in exc.errors()]
        raise RuntimeError(
            "Konfigurasi belum lengkap: " + ", ".join(missing) + ". "
            "Isi nilainya di backend/.env (contoh ada di backend/.env.example)."
        ) from None
