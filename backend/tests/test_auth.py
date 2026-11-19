from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.deps import AuthenticatedUser, require_roles
from app.core.security import create_access_token
from app.db.models import User
from app.db.session import SessionLocal

ACCOUNTS = [
    ("budi", "Operator", "Budi Santoso"),
    ("rina", "Operator", "Rina Wulandari"),
    ("siti", "Manajemen", "Siti Rahma"),
    ("dewi", "Manajemen", "Dewi Lestari"),
    ("andi", "Admin", "Andi Pratama"),
    ("agus", "Admin", "Agus Setiawan"),
]

LOGIN_ERROR = "Username atau password salah"

# Aplikasi kecil untuk menguji require_roles tanpa menunggu endpoint Admin di fase 2.
probe_app = FastAPI()


@probe_app.get("/probe-admin")
def probe_admin(current: AuthenticatedUser = Depends(require_roles("ADMIN"))):
    return {"username": current.user.username}


def login(client: TestClient, username: str, password: str = "gudang04") -> dict:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# F1-T1
@pytest.mark.parametrize(("username", "role", "name"), ACCOUNTS)
def test_login_each_seeded_account(client, username, role, name):
    body = login(client, username)
    assert body["username"] == username
    assert body["role"] == role
    assert body["name"] == name


# F1-T2
def test_login_response_shape_and_expiry(client):
    before = datetime.now(timezone.utc)
    body = login(client, "budi")

    assert set(body) == {"token", "username", "name", "role", "expiresAt"}
    assert isinstance(body["token"], str) and body["token"].count(".") == 2

    expected_min = int((before + timedelta(minutes=29)).timestamp() * 1000)
    expected_max = int((before + timedelta(minutes=31)).timestamp() * 1000)
    assert expected_min <= body["expiresAt"] <= expected_max


# F1-T3
def test_wrong_password_returns_generic_error(client):
    response = client.post(
        "/api/auth/login", json={"username": "budi", "password": "salah-total"}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": LOGIN_ERROR}


# F1-T4
def test_unknown_username_returns_same_error(client):
    response = client.post(
        "/api/auth/login", json={"username": "tidak-ada", "password": "gudang04"}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": LOGIN_ERROR}


# F1-T5
def test_me_returns_current_user(client):
    body = login(client, "siti")
    response = client.get("/api/auth/me", headers=auth_headers(body["token"]))

    assert response.status_code == 200
    me = response.json()
    assert me["username"] == "siti"
    assert me["name"] == "Siti Rahma"
    assert me["role"] == "Manajemen"
    assert me["expiresAt"] == body["expiresAt"]


# F1-T6
def test_invalid_signature_rejected(client):
    token = login(client, "budi")["token"]
    header, payload, _signature = token.split(".")
    tampered = f"{header}.{payload}.invalid-signature"

    response = client.get("/api/auth/me", headers=auth_headers(tampered))
    assert response.status_code == 401


def test_expired_token_rejected(client):
    expired, _ = create_access_token(
        user_id=1,
        username="budi",
        role="OPERATOR",
        now=datetime.now(timezone.utc) - timedelta(minutes=61),
    )
    response = client.get("/api/auth/me", headers=auth_headers(expired))
    assert response.status_code == 401


# F1-T7
def test_missing_token_returns_401_not_500(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"]


# F1-T8
def test_passwords_are_hashed_in_database(client):
    with SessionLocal() as db:
        users = db.scalars(select(User)).all()

    assert len(users) == 6
    for user in users:
        assert user.password_hash.startswith("$2b$")
        assert user.password_hash != "gudang04"


# F1-T9
def test_role_guard_blocks_operator(client):
    operator_token = login(client, "budi")["token"]
    admin_token = login(client, "andi")["token"]

    with TestClient(probe_app) as probe:
        forbidden = probe.get("/probe-admin", headers=auth_headers(operator_token))
        allowed = probe.get("/probe-admin", headers=auth_headers(admin_token))

    assert forbidden.status_code == 403
    assert forbidden.json() == {"detail": "Akses ditolak"}
    assert allowed.status_code == 200
    assert allowed.json() == {"username": "andi"}


def test_login_normalizes_username(client):
    response = client.post(
        "/api/auth/login", json={"username": "  BUDI  ", "password": "gudang04"}
    )
    assert response.status_code == 200
    assert response.json()["username"] == "budi"
