from datetime import datetime

import pytest
from sqlalchemy import select

from app.db.models import Setting
from app.db.session import SessionLocal

OLD_UPDATED_AT = datetime(2026, 1, 1, 0, 0)


def auth_headers(client, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": "gudang04"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def reset_setting(value: float = 0.75) -> None:
    with SessionLocal() as db:
        setting = db.scalar(select(Setting).order_by(Setting.id).limit(1))
        setting.threshold_confidence = value
        setting.diperbarui_pada = OLD_UPDATED_AT
        setting.diperbarui_oleh = None
        db.commit()


def current_setting() -> Setting:
    with SessionLocal() as db:
        return db.scalar(select(Setting).order_by(Setting.id).limit(1))


# F2-T1
def test_get_threshold_default_as_operator(client):
    reset_setting(0.75)
    response = client.get("/api/settings/threshold", headers=auth_headers(client, "budi"))

    assert response.status_code == 200
    body = response.json()
    assert body["value"] == 0.75
    assert body["updatedAt"]  # terisi, bukan string kosong


# F2-T2
def test_admin_can_update_threshold(client):
    reset_setting(0.75)
    admin = auth_headers(client, "andi")

    response = client.put("/api/settings/threshold", json={"value": 0.8}, headers=admin)

    assert response.status_code == 200
    body = response.json()
    assert body["value"] == 0.8
    assert body["updatedAt"] != "2026-01-01T07:00:00+07:00"
    assert body["updatedAt"].endswith("+07:00")

    stored = current_setting()
    assert stored.threshold_confidence == 0.8
    assert stored.diperbarui_oleh is not None


# F2-T3
def test_get_reflects_update(client):
    reset_setting(0.75)
    admin = auth_headers(client, "andi")
    client.put("/api/settings/threshold", json={"value": 0.8}, headers=admin)

    response = client.get("/api/settings/threshold", headers=auth_headers(client, "budi"))

    assert response.status_code == 200
    assert response.json()["value"] == 0.8


# F2-T4
def test_operator_cannot_update_threshold(client):
    reset_setting(0.75)
    response = client.put(
        "/api/settings/threshold",
        json={"value": 0.9},
        headers=auth_headers(client, "budi"),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Akses ditolak"}
    assert current_setting().threshold_confidence == 0.75


# F2-T5
def test_management_cannot_update_threshold(client):
    reset_setting(0.75)
    response = client.put(
        "/api/settings/threshold",
        json={"value": 0.9},
        headers=auth_headers(client, "siti"),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Akses ditolak"}
    assert current_setting().threshold_confidence == 0.75


# F2-T6
@pytest.mark.parametrize("value", [-0.1, 1.5, "abc", None])
def test_invalid_threshold_rejected(client, value):
    reset_setting(0.75)
    response = client.put(
        "/api/settings/threshold",
        json={"value": value},
        headers=auth_headers(client, "andi"),
    )

    assert response.status_code == 422
    assert current_setting().threshold_confidence == 0.75


# F2-T7
@pytest.mark.parametrize("value", [0.0, 1.0])
def test_threshold_bounds_are_inclusive(client, value):
    reset_setting(0.75)
    response = client.put(
        "/api/settings/threshold",
        json={"value": value},
        headers=auth_headers(client, "andi"),
    )

    assert response.status_code == 200
    assert response.json()["value"] == value
    assert current_setting().threshold_confidence == value


# F2-T8
def test_threshold_requires_token(client):
    assert client.get("/api/settings/threshold").status_code == 401
    assert client.put("/api/settings/threshold", json={"value": 0.5}).status_code == 401
