from datetime import datetime

import pytest

OCT_RANGE = {"start_date": "2026-10-01", "end_date": "2026-10-29"}
SEED_TOTAL = 128


def auth_headers(client, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": "gudang04"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def get_riwayat(client, username: str = "budi", **params):
    return client.get("/api/riwayat", params=params, headers=auth_headers(client, username))


# F5-T1
def test_default_pagination(client):
    response = get_riwayat(client, page=1, page_size=5, **OCT_RANGE)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == SEED_TOTAL
    assert body["page"] == 1
    assert body["page_size"] == 5
    assert body["page_count"] == 26
    assert len(body["data"]) == 5


# F5-T2
def test_results_sorted_newest_first(client):
    response = get_riwayat(client, page=1, page_size=100, **OCT_RANGE)
    stamps = [datetime.fromisoformat(item["timestamp"]) for item in response.json()["data"]]

    assert stamps == sorted(stamps, reverse=True)


# F5-T3
def test_filter_by_date(client):
    response = get_riwayat(
        client, start_date="2026-10-29", end_date="2026-10-29", page_size=100
    )
    body = response.json()

    assert body["total"] == 3
    assert {item["id"] for item in body["data"]} == {126, 127, 128}
    assert all(item["timestamp"].startswith("2026-10-29") for item in body["data"])


# F5-T4
def test_filter_by_status(client):
    finals = get_riwayat(client, status="final", page_size=100, **OCT_RANGE).json()
    reviews = get_riwayat(client, status="review", page_size=100, **OCT_RANGE).json()
    reviewed = get_riwayat(client, status="reviewed", page_size=100, **OCT_RANGE).json()

    assert finals["total"] == 115
    assert reviews["total"] == 9
    assert reviewed["total"] == 4

    assert all(item["status"] == "Final" for item in finals["data"])
    assert all(item["status"] == "Perlu review" for item in reviews["data"])
    assert all(item["status"] == "Sudah direview" for item in reviewed["data"])
    assert finals["total"] + reviews["total"] + reviewed["total"] == SEED_TOTAL


# F5-T5
def test_filter_by_label(client):
    body = get_riwayat(client, label="penyok", page_size=100, **OCT_RANGE).json()

    assert body["total"] > 0
    assert body["total"] == len(body["data"])
    assert all(item["label"] == "penyok" for item in body["data"])


# F5-T6
def test_combined_filters(client):
    body = get_riwayat(
        client,
        status="reviewed",
        label="robek",
        page_size=100,
        **OCT_RANGE,
    ).json()

    assert body["total"] >= 1  # INS-127 adalah robek yang sudah direview
    assert body["total"] == len(body["data"])
    for item in body["data"]:
        assert item["status"] == "Sudah direview"
        assert item["label"] == "robek"


# F5-T7
def test_empty_range_returns_empty_list(client):
    response = get_riwayat(client, start_date="2026-09-01", end_date="2026-09-02")
    body = response.json()

    assert response.status_code == 200
    assert body["data"] == []
    assert body["total"] == 0
    assert body["page_count"] == 0


# F5-T8
def test_page_beyond_range(client):
    body = get_riwayat(client, page=999, page_size=5, **OCT_RANGE).json()

    assert body["data"] == []
    assert body["total"] == SEED_TOTAL
    assert body["page_count"] == 26


# F5-T9
def test_detail_matches_list_item(client):
    detail = client.get("/api/riwayat/128", headers=auth_headers(client, "budi"))

    assert detail.status_code == 200
    body = detail.json()
    assert body["display_id"] == "INS-128"
    assert body["label"] == "penyok"
    assert body["confidence"] == 0.91

    listing = get_riwayat(
        client, start_date="2026-10-29", end_date="2026-10-29", page_size=100
    ).json()
    item = next(row for row in listing["data"] if row["id"] == 128)
    assert item == body


# F5-T10
def test_detail_not_found(client):
    response = client.get("/api/riwayat/999999", headers=auth_headers(client, "budi"))

    assert response.status_code == 404
    assert response.json()["detail"] == "Inspeksi tidak ditemukan"


# F5-T11
def test_admin_is_forbidden(client):
    headers = auth_headers(client, "andi")

    listing = client.get("/api/riwayat", headers=headers)
    detail = client.get("/api/riwayat/128", headers=headers)

    assert listing.status_code == 403
    assert detail.status_code == 403
    assert listing.json() == {"detail": "Akses ditolak"}


# F5-T12
def test_operator_and_management_see_same_dataset(client):
    params = {"status": "final", "page_size": 20, **OCT_RANGE}

    as_operator = get_riwayat(client, "budi", **params).json()
    as_management = get_riwayat(client, "siti", **params).json()

    assert as_operator == as_management


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"status": "selesai"}, 422),
        ({"label": "basah"}, 422),
        ({"sumber": "fax"}, 422),
        ({"start_date": "2026-13-01"}, 422),
        ({"start_date": "2026-10-29", "end_date": "2026-10-01"}, 422),
    ],
)
def test_query_validation(client, params, expected):
    response = get_riwayat(client, **params)
    assert response.status_code == expected
