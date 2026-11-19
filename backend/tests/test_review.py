from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy import select

from app.db.models import HasilDeteksi, Setting
from app.db.session import SessionLocal
from app.services.inference import Detection

THRESHOLD = 0.75


def auth_headers(client, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": "gudang04"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def make_jpeg(color: tuple[int, int, int]) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (40, 30), color).save(buffer, format="JPEG")
    return buffer.getvalue()


def create_inspection(client, monkeypatch, confidence: float, color: tuple[int, int, int]) -> dict:
    monkeypatch.setattr(
        "app.services.inference.detect",
        lambda _path: [Detection("robek", confidence, (0.2, 0.2, 0.3, 0.3))]
        if confidence
        else [],
    )
    response = client.post(
        "/api/deteksi/upload",
        files={"file": (f"review-{confidence}.jpg", make_jpeg(color), "image/jpeg")},
        headers=auth_headers(client, "budi"),
    )
    assert response.status_code == 200, response.text
    return response.json()


def create_pending(client, monkeypatch, color: tuple[int, int, int] = (11, 22, 33)) -> dict:
    return create_inspection(client, monkeypatch, 0.62, color)


@pytest.fixture(autouse=True)
def reset_threshold():
    with SessionLocal() as db:
        setting = db.scalar(select(Setting).order_by(Setting.id).limit(1))
        setting.threshold_confidence = THRESHOLD
        db.commit()
    yield


# F4-T1
def test_review_pending_inspection(client, monkeypatch):
    record = create_pending(client, monkeypatch, (40, 50, 60))

    response = client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": "CACAT", "catatan": "Robekan jelas"},
        headers=auth_headers(client, "budi"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "Sudah direview"
    assert body["result"] == "Cacat"
    assert body["review_decision"] == "CACAT"
    assert body["review_note"] == "Robekan jelas"


# F4-T2
def test_review_fields_are_persisted(client, monkeypatch):
    record = create_pending(client, monkeypatch, (41, 51, 61))

    client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": "CACAT", "catatan": "  Ada sobekan  "},
        headers=auth_headers(client, "budi"),
    )

    with SessionLocal() as db:
        hasil = db.scalar(select(HasilDeteksi).where(HasilDeteksi.inspeksi_id == record["id"]))
        inspeksi = hasil.inspeksi

        assert hasil.keputusan_manual == "CACAT"
        assert hasil.catatan == "Ada sobekan"
        assert hasil.status_review == "SELESAI"
        assert hasil.direview_oleh is not None
        assert hasil.direview_pada is not None
        assert inspeksi.status == "TERSIMPAN"


# F4-T3
def test_review_does_not_change_confidence(client, monkeypatch):
    record = create_pending(client, monkeypatch, (42, 52, 62))

    response = client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": "CACAT"},
        headers=auth_headers(client, "budi"),
    )

    assert response.json()["confidence"] == record["confidence"] == 0.62


# F4-T4
def test_review_can_mark_as_not_defective(client, monkeypatch):
    record = create_pending(client, monkeypatch, (43, 53, 63))

    response = client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": "TIDAK_CACAT", "catatan": "Hanya bayangan"},
        headers=auth_headers(client, "budi"),
    )

    body = response.json()
    assert body["status"] == "Sudah direview"
    assert body["result"] == "Tidak cacat"
    assert body["review_decision"] == "TIDAK_CACAT"


# F4-T5
def test_second_review_is_rejected(client, monkeypatch):
    record = create_pending(client, monkeypatch, (44, 54, 64))
    headers = auth_headers(client, "budi")

    first = client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": "CACAT"},
        headers=headers,
    )
    second = client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": "TIDAK_CACAT"},
        headers=headers,
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "Hasil sudah direview"


# F4-T6
def test_review_final_inspection_is_rejected(client, monkeypatch):
    record = create_inspection(client, monkeypatch, 0.91, (45, 55, 65))

    response = client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": "CACAT"},
        headers=auth_headers(client, "budi"),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Hasil ini tidak memerlukan review manual"


# F4-T7
def test_review_missing_inspection(client):
    response = client.post(
        "/api/deteksi/999999/review",
        json={"keputusan": "CACAT"},
        headers=auth_headers(client, "budi"),
    )

    assert response.status_code == 404


# F4-T8
@pytest.mark.parametrize("keputusan", ["MAYBE", "", 1])
def test_invalid_decision_rejected(client, monkeypatch, keputusan):
    record = create_pending(client, monkeypatch, (46, 56, 66))

    response = client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": keputusan},
        headers=auth_headers(client, "budi"),
    )

    assert response.status_code == 422

    with SessionLocal() as db:
        hasil = db.scalar(select(HasilDeteksi).where(HasilDeteksi.inspeksi_id == record["id"]))
        assert hasil.status_review == "MENUNGGU"
        assert hasil.keputusan_manual is None


# F4-T9
@pytest.mark.parametrize("username", ["siti", "andi"])
def test_review_forbidden_for_other_roles(client, monkeypatch, username):
    record = create_pending(client, monkeypatch, (47, 57, 67))

    response = client.post(
        f"/api/deteksi/{record['id']}/review",
        json={"keputusan": "CACAT"},
        headers=auth_headers(client, username),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Akses ditolak"}
