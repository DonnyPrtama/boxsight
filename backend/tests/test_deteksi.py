import hashlib
from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.models import Gambar, Inspeksi, Setting
from app.db.seed import DEMO_IMAGE_URL, seed_inspeksi
from app.db.session import SessionLocal
from app.services.inference import Detection

THRESHOLD = 0.75


def auth_headers(client, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": "gudang04"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def make_jpeg(color: tuple[int, int, int] = (210, 190, 160), size: tuple[int, int] = (64, 48)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color).save(buffer, format="JPEG")
    return buffer.getvalue()


def count_rows(model) -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count(model.id)))


@pytest.fixture(autouse=True)
def reset_threshold():
    with SessionLocal() as db:
        setting = db.scalar(select(Setting).order_by(Setting.id).limit(1))
        setting.threshold_confidence = THRESHOLD
        db.commit()
    yield


# F3-T1
def test_upload_returns_inspection_dto(client):
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("kemasan_uji.jpg", make_jpeg(), "image/jpeg")},
        data={"sumber": "upload"},
        headers=auth_headers(client, "budi"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {
        "id",
        "display_id",
        "timestamp",
        "label",
        "confidence",
        "result",
        "status",
        "operator",
        "source",
        "file",
        "file_size",
        "image_url",
        "bounding_box",
        "review_decision",
        "review_note",
    }
    assert body["display_id"] == f"INS-{body['id']:03d}"
    assert body["operator"] == "Budi Santoso"
    assert body["file"] == "kemasan_uji.jpg"
    assert body["timestamp"].endswith("+07:00")
    assert body["status"] in {"Final", "Perlu review"}


# F3-T2
def test_upload_persists_rows_consistently(client):
    before = count_rows(Inspeksi)
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("konsisten.jpg", make_jpeg((200, 200, 200)), "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )
    assert response.status_code == 200
    body = response.json()

    assert count_rows(Inspeksi) == before + 1
    assert count_rows(Gambar) == before + 1

    with SessionLocal() as db:
        inspeksi = db.get(Inspeksi, body["id"])
        hasil = inspeksi.hasil_deteksi[0]
        assert inspeksi.gambar_id == inspeksi.gambar.id
        if hasil.perlu_review:
            assert inspeksi.status == "PERLU_REVIEW_MANUAL"
        else:
            assert inspeksi.status == "SELESAI"


# F3-T3
def test_high_confidence_is_final_defect(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.inference.detect",
        lambda _path: [Detection("penyok", 0.91, (0.1, 0.2, 0.3, 0.25))],
    )
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("final.jpg", make_jpeg((10, 20, 30)), "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )

    body = response.json()
    assert response.status_code == 200
    assert body["confidence"] == 0.91
    assert body["label"] == "penyok"
    assert body["result"] == "Cacat"
    assert body["status"] == "Final"


# F3-T4
def test_low_confidence_requires_review(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.inference.detect",
        lambda _path: [Detection("robek", 0.62, (0.2, 0.2, 0.3, 0.3))],
    )
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("review.jpg", make_jpeg((30, 40, 50)), "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )

    body = response.json()
    assert response.status_code == 200
    assert body["confidence"] == 0.62
    assert body["result"] is None
    assert body["status"] == "Perlu review"

    with SessionLocal() as db:
        inspeksi = db.get(Inspeksi, body["id"])
        hasil = inspeksi.hasil_deteksi[0]
        assert inspeksi.status == "PERLU_REVIEW_MANUAL"
        assert hasil.perlu_review == 1
        assert hasil.status_review == "MENUNGGU"


# F3-T5
def test_no_detection_is_clean_and_final(client, monkeypatch):
    monkeypatch.setattr("app.services.inference.detect", lambda _path: [])
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("bersih.jpg", make_jpeg((60, 70, 80)), "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )

    body = response.json()
    assert response.status_code == 200
    assert body["label"] is None
    assert body["confidence"] == 1.0
    assert body["result"] == "Tidak cacat"
    assert body["status"] == "Final"
    assert body["bounding_box"] is None


# F3-T6
@pytest.mark.parametrize(
    ("filename", "payload", "content_type"),
    [
        ("catatan.txt", b"ini bukan gambar", "text/plain"),
        ("dokumen.pdf", b"%PDF-1.4\n1 0 obj\n", "application/pdf"),
    ],
)
def test_non_image_rejected(client, filename, payload, content_type):
    before = count_rows(Inspeksi)
    response = client.post(
        "/api/deteksi/upload",
        files={"file": (filename, payload, content_type)},
        headers=auth_headers(client, "budi"),
    )

    assert response.status_code == 422
    assert count_rows(Inspeksi) == before


# F3-T7
def test_oversized_file_rejected(client):
    before = count_rows(Inspeksi)
    storage = get_settings().storage_dir
    files_before = sum(1 for _ in storage.rglob("*") if _.is_file())

    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("besar.jpg", b"\xff" * (6 * 1024 * 1024), "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )

    assert response.status_code == 422
    assert "5 MB" in response.json()["detail"]
    assert count_rows(Inspeksi) == before
    assert sum(1 for _ in storage.rglob("*") if _.is_file()) == files_before


# F3-T8
@pytest.mark.parametrize("username", ["siti", "andi"])
def test_upload_forbidden_for_other_roles(client, username):
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("x.jpg", make_jpeg((90, 90, 90)), "image/jpeg")},
        headers=auth_headers(client, username),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Akses ditolak"}


# F3-T9
def test_file_saved_with_hash_name(client):
    payload = make_jpeg((120, 100, 80), (80, 60))
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("nama asli.jpg", payload, "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )
    body = response.json()

    relative = body["image_url"].removeprefix("/api/files/")
    target = get_settings().storage_dir / relative
    assert target.is_file()
    assert target.parent.parent.name == "2026"
    assert len(target.parent.name) == 2
    assert target.name == hashlib.sha256(payload).hexdigest()[:20] + ".jpg"
    assert body["file"] == "nama asli.jpg"


# F3-T10
def test_bounding_box_present_for_defect(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.inference.detect",
        lambda _path: [Detection("label_rusak", 0.88, (0.15, 0.25, 0.35, 0.2))],
    )
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("box.jpg", make_jpeg((140, 120, 100)), "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )

    box = response.json()["bounding_box"]
    assert box is not None
    assert set(box) == {"x", "y", "lebar", "tinggi"}
    assert all(0 <= box[key] <= 1 for key in box)
    assert box["x"] + box["lebar"] <= 1
    assert box["y"] + box["tinggi"] <= 1


# F3-T11
def test_uploaded_image_is_served(client):
    response = client.post(
        "/api/deteksi/upload",
        files={"file": ("serve.jpg", make_jpeg((180, 150, 120)), "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )
    image_url = response.json()["image_url"]

    served = client.get(image_url)
    assert served.status_code == 200
    assert served.headers["content-type"].startswith("image/jpeg")
    assert len(served.content) > 0


# F3-T12
@pytest.mark.parametrize(
    "path",
    [
        "..%2f..%2f.env",
        "%2e%2e%2f%2e%2e%2f.env",
        "2026/10/..%2f..%2f..%2f.env",
    ],
)
def test_path_traversal_blocked(client, path):
    response = client.get(f"/api/files/{path}")

    assert response.status_code in (400, 404)
    assert "JWT_SECRET" not in response.text


# F3-T13
def test_seed_is_idempotent(client):
    before = count_rows(Inspeksi)
    with SessionLocal() as db:
        assert seed_inspeksi(db) == 0
        assert seed_inspeksi(db) == 0
    assert count_rows(Inspeksi) == before


# F3-T14
def test_seed_data_covers_october_2026(client):
    with SessionLocal() as db:
        stamps = db.scalars(
            select(Inspeksi.timestamp)
            .join(Gambar, Gambar.id == Inspeksi.gambar_id)
            .where(Gambar.image_url == DEMO_IMAGE_URL)
        ).all()

    assert len(stamps) == 128
    assert {stamp.year for stamp in stamps} == {2026}
    assert {stamp.month for stamp in stamps} == {10}
    assert min(stamps).day >= 1
    assert max(stamps).day <= 29
