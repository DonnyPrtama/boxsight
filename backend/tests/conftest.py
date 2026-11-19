import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_TEST_DIR = Path(tempfile.mkdtemp(prefix="boxsight-test-"))

# Muat backend/.env supaya TEST_DATABASE_URL tidak perlu diekspor manual.
load_dotenv(_BACKEND_DIR / ".env")

test_db_url = os.environ.get("TEST_DATABASE_URL")
if not test_db_url:
    raise RuntimeError(
        "TEST_DATABASE_URL belum diisi. Tambahkan ke backend/.env, misalnya "
        "postgresql+psycopg://boxsight:password@127.0.0.1:5433/boxsight_test."
    )

# Harus di-set sebelum modul app diimpor, karena Settings dibaca saat import.
os.environ["JWT_SECRET"] = "test-secret-yang-cukup-panjang-untuk-validasi-32"
os.environ["DB_URL"] = test_db_url
os.environ["STORAGE_DIR"] = str(_TEST_DIR / "storage")
os.environ["MAX_UPLOAD_BYTES"] = str(5 * 1024 * 1024)
os.environ["INFERENCE_BACKEND"] = "stub"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import models  # noqa: E402,F401  daftarkan tabel ke metadata
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _fresh_schema():
    # Skema tes selalu dibangun ulang supaya sisa run sebelumnya tidak ikut.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
