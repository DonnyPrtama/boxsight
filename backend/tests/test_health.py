import pytest
from pydantic import ValidationError
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.db.base import Base
from app.db.models import Inspeksi
from app.db.session import SessionLocal, engine


def test_health_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_all_tables_created(client):
    tables = set(inspect(engine).get_table_names())
    assert {
        "users",
        "settings",
        "gambar",
        "inspeksi",
        "hasil_deteksi",
        "bounding_box",
    } <= tables


def test_database_is_postgres(client):
    with engine.connect() as connection:
        assert connection.dialect.name == "postgresql"
        assert connection.exec_driver_sql("SELECT 1").scalar() == 1


def test_foreign_keys_enforced(client):
    with SessionLocal() as db:
        db.add(Inspeksi(operator_id=10**9, gambar_id=10**9, status="SELESAI"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_missing_jwt_secret_is_rejected(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_openapi_lists_health(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/api/health" in response.json()["paths"]


def test_metadata_matches_plan():
    # Enam tabel, tidak lebih, sampai fase berikutnya menambah apa pun.
    assert set(Base.metadata.tables) == {
        "users",
        "settings",
        "gambar",
        "inspeksi",
        "hasil_deteksi",
        "bounding_box",
    }
