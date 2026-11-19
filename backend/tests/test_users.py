import pytest
from sqlalchemy import select

from app.db.models import User
from app.db.session import SessionLocal

PASSWORD = "rahasia123"


def auth_headers(client, username: str, password: str = "gudang04") -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def create_payload(**overrides) -> dict:
    payload = {
        "nama": "Uji Operator",
        "username": "ujioperator",
        "role": "Operator",
        "password": PASSWORD,
    }
    payload.update(overrides)
    return payload


def find_user(client, username: str) -> dict:
    rows = client.get("/api/users", headers=auth_headers(client, "andi")).json()
    return next(row for row in rows if row["username"] == username)


# F9-T1
def test_list_users(client):
    response = client.get("/api/users", headers=auth_headers(client, "andi"))

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 6
    assert {row["username"] for row in rows} == {"budi", "rina", "siti", "dewi", "andi", "agus"}
    for row in rows:
        assert set(row) == {"id", "nama", "username", "role"}
        assert "password" not in row


# F9-T2
def test_create_user_and_login(client):
    response = client.post(
        "/api/users", json=create_payload(), headers=auth_headers(client, "andi")
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["username"] == "ujioperator"
    assert body["role"] == "Operator"

    login = client.post(
        "/api/auth/login", json={"username": "ujioperator", "password": PASSWORD}
    )
    assert login.status_code == 200
    assert login.json()["role"] == "Operator"


# F9-T3
def test_duplicate_username_rejected(client):
    response = client.post(
        "/api/users",
        json=create_payload(username="UjiOperator"),
        headers=auth_headers(client, "andi"),
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Username sudah dipakai"}


# F9-T4
def test_update_name_and_role(client):
    user = find_user(client, "ujioperator")
    response = client.put(
        f"/api/users/{user['id']}",
        json={"nama": "Uji Manajemen", "username": "ujioperator", "role": "Manajemen"},
        headers=auth_headers(client, "andi"),
    )

    assert response.status_code == 200
    assert response.json()["nama"] == "Uji Manajemen"
    assert response.json()["role"] == "Manajemen"

    login = client.post(
        "/api/auth/login", json={"username": "ujioperator", "password": PASSWORD}
    )
    assert login.json()["role"] == "Manajemen"


# F9-T5
def test_update_password(client):
    user = find_user(client, "ujioperator")
    response = client.put(
        f"/api/users/{user['id']}",
        json={
            "nama": "Uji Manajemen",
            "username": "ujioperator",
            "role": "Manajemen",
            "password": "passwordbaru1",
        },
        headers=auth_headers(client, "andi"),
    )
    assert response.status_code == 200

    old = client.post(
        "/api/auth/login", json={"username": "ujioperator", "password": PASSWORD}
    )
    new = client.post(
        "/api/auth/login", json={"username": "ujioperator", "password": "passwordbaru1"}
    )
    assert old.status_code == 401
    assert new.status_code == 200


# F9-T6
def test_update_without_password_keeps_hash(client):
    user = find_user(client, "ujioperator")
    with SessionLocal() as db:
        before = db.scalar(select(User.password_hash).where(User.username == "ujioperator"))

    response = client.put(
        f"/api/users/{user['id']}",
        json={"nama": "Uji Manajemen", "username": "ujioperator", "role": "Manajemen", "password": ""},
        headers=auth_headers(client, "andi"),
    )
    assert response.status_code == 200

    with SessionLocal() as db:
        after = db.scalar(select(User.password_hash).where(User.username == "ujioperator"))

    assert before == after
    login = client.post(
        "/api/auth/login", json={"username": "ujioperator", "password": "passwordbaru1"}
    )
    assert login.status_code == 200


# F9-T7
def test_delete_user(client):
    user = find_user(client, "ujioperator")
    response = client.delete(f"/api/users/{user['id']}", headers=auth_headers(client, "andi"))

    assert response.status_code == 204
    login = client.post(
        "/api/auth/login", json={"username": "ujioperator", "password": "passwordbaru1"}
    )
    assert login.status_code == 401

    rows = client.get("/api/users", headers=auth_headers(client, "andi")).json()
    assert all(row["username"] != "ujioperator" for row in rows)


# F9-T8
def test_cannot_delete_self(client):
    admin = find_user(client, "andi")
    response = client.delete(f"/api/users/{admin['id']}", headers=auth_headers(client, "andi"))

    assert response.status_code == 409
    assert response.json() == {"detail": "Tidak bisa menghapus akun sendiri"}
    assert find_user(client, "andi")


# F9-T9
def test_cannot_demote_self(client):
    admin = find_user(client, "andi")
    response = client.put(
        f"/api/users/{admin['id']}",
        json={"nama": "Andi Pratama", "username": "andi", "role": "Operator"},
        headers=auth_headers(client, "andi"),
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Tidak bisa menurunkan role akun sendiri"}
    assert find_user(client, "andi")["role"] == "Admin"


# F9-T10
@pytest.mark.parametrize("username", ["budi", "siti"])
def test_forbidden_for_other_roles(client, username):
    headers = auth_headers(client, username)
    target = find_user(client, "agus")

    assert client.get("/api/users", headers=headers).status_code == 403
    assert (
        client.post("/api/users", json=create_payload(username="baru"), headers=headers).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/users/{target['id']}",
            json={"nama": "X", "username": "agus", "role": "Admin"},
            headers=headers,
        ).status_code
        == 403
    )
    assert client.delete(f"/api/users/{target['id']}", headers=headers).status_code == 403


def test_delete_user_with_inspections_rejected(client):
    budi = find_user(client, "budi")
    response = client.delete(f"/api/users/{budi['id']}", headers=auth_headers(client, "andi"))

    assert response.status_code == 409
    assert "inspeksi" in response.json()["detail"]
    assert find_user(client, "budi")


def test_create_user_validation(client):
    headers = auth_headers(client, "andi")

    assert client.post("/api/users", json=create_payload(password="pendek"), headers=headers).status_code == 422
    assert client.post("/api/users", json=create_payload(role="Owner"), headers=headers).status_code == 422
    assert client.post("/api/users", json=create_payload(nama=""), headers=headers).status_code == 422


def test_update_missing_user(client):
    response = client.put(
        "/api/users/999999",
        json={"nama": "Hantu", "username": "hantu", "role": "Operator"},
        headers=auth_headers(client, "andi"),
    )
    assert response.status_code == 404
