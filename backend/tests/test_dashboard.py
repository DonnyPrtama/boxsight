from datetime import datetime

import pytest
from sqlalchemy import and_, func, not_, or_, select

from app.db.models import HasilDeteksi, Inspeksi
from app.db.session import SessionLocal

OCT = {"start_date": "2026-10-01", "end_date": "2026-10-29"}


def auth_headers(client, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": "gudang04"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def get_dashboard(client, username: str = "budi", **params):
    return client.get(
        "/api/dashboard", params=params, headers=auth_headers(client, username)
    )


# F7-T1
def test_total_matches_riwayat(client):
    dashboard = get_dashboard(client, **OCT).json()
    riwayat = client.get(
        "/api/riwayat",
        params={"page_size": 1, **OCT},
        headers=auth_headers(client, "budi"),
    ).json()

    assert dashboard["total"] == riwayat["total"] == 128


# F7-T2
def test_counts_add_up(client):
    body = get_dashboard(client, **OCT).json()

    assert body["cacat"] == 37
    assert body["tidak_cacat"] == 82
    assert body["review_manual"] == 9
    assert body["cacat"] + body["tidak_cacat"] + body["review_manual"] == body["total"]


# F7-T3
def test_defect_breakdown_matches_database(client):
    body = get_dashboard(client, **OCT).json()

    labels = [item["label"] for item in body["defects"]]
    assert labels and "Lainnya" not in labels
    assert set(labels) <= {"penyok", "robek", "label_rusak"}
    assert sum(item["count"] for item in body["defects"]) == body["cacat"]

    with SessionLocal() as db:
        pending = and_(HasilDeteksi.perlu_review == 1, HasilDeteksi.status_review == "MENUNGGU")
        rows = db.execute(
            select(HasilDeteksi.label, func.count(HasilDeteksi.id))
            .join(Inspeksi, Inspeksi.id == HasilDeteksi.inspeksi_id)
            .where(
                Inspeksi.timestamp >= datetime(2026, 10, 1),
                Inspeksi.timestamp < datetime(2026, 10, 30),
                not_(pending),
                HasilDeteksi.label.is_not(None),
                or_(
                    HasilDeteksi.status_review != "SELESAI",
                    HasilDeteksi.keputusan_manual == "CACAT",
                ),
            )
            .group_by(HasilDeteksi.label)
        ).all()
    expected = {label: count for label, count in rows}
    assert {item["label"]: item["count"] for item in body["defects"]} == expected


# F7-T4
def test_trend_buckets_cover_active_days(client):
    body = get_dashboard(client, **OCT).json()
    trend = body["trend"]

    with SessionLocal() as db:
        days = db.execute(
            select(Inspeksi.timestamp)
            .join(HasilDeteksi, HasilDeteksi.inspeksi_id == Inspeksi.id)
            .where(
                Inspeksi.timestamp >= datetime(2026, 10, 1),
                Inspeksi.timestamp < datetime(2026, 10, 30),
                not_(
                    and_(
                        HasilDeteksi.perlu_review == 1,
                        HasilDeteksi.status_review == "MENUNGGU",
                    )
                ),
            )
        ).scalars().all()

    assert len(trend) == len({stamp.date() for stamp in days})
    assert len(trend) >= 25
    assert trend[0]["date"] < trend[-1]["date"]
    assert all(point["clean"] + point["defect"] > 0 for point in trend)
    # Review yang belum diputuskan tidak masuk chart.
    assert sum(point["clean"] + point["defect"] for point in trend) == body["total"] - body["review_manual"]


# F7-T5
def test_empty_period_returns_zeroes(client):
    body = get_dashboard(client, start_date="2026-09-01", end_date="2026-09-02").json()

    assert body == {
        "total": 0,
        "cacat": 0,
        "tidak_cacat": 0,
        "review_manual": 0,
        "defects": [],
        "trend": [],
    }


# F7-T6
@pytest.mark.parametrize(
    "params",
    [
        {"start_date": "2026-10-29", "end_date": "2026-10-01"},
        {"start_date": "2026-13-01"},
        {"end_date": "besok"},
    ],
)
def test_invalid_period_rejected(client, params):
    assert get_dashboard(client, **params).status_code == 422


# F7-T8
@pytest.mark.parametrize("username", ["budi", "siti", "andi"])
def test_all_roles_can_read_dashboard(client, username):
    response = get_dashboard(client, username, **OCT)
    assert response.status_code == 200
    assert response.json()["total"] == 128


def test_dashboard_without_token(client):
    assert client.get("/api/dashboard").status_code == 401


def test_single_day_period(client):
    body = get_dashboard(
        client, start_date="2026-10-29", end_date="2026-10-29"
    ).json()

    assert body["total"] == 3
    assert len(body["trend"]) == 1
    assert body["trend"][0]["date"] == "2026-10-29"
    assert body["trend"][0]["clean"] == 1
    assert body["trend"][0]["defect"] == 2
    assert body["review_manual"] == 0
