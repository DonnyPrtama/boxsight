from io import BytesIO

import pytest
from openpyxl import load_workbook
from pypdf import PdfReader

OCT = {"start_date": "2026-10-01", "end_date": "2026-10-29"}


def auth_headers(client, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": "gudang04"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def export(client, payload: dict, username: str = "budi"):
    return client.post(
        "/api/riwayat/export", json=payload, headers=auth_headers(client, username)
    )


# F8-T1
def test_export_pdf(client):
    response = export(client, {"format": "pdf", "filters": OCT})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")


# F8-T2
def test_export_xlsx(client):
    response = export(client, {"format": "xlsx", "filters": OCT})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.content.startswith(b"PK\x03\x04")


# F8-T3
def test_export_respects_filters(client):
    filters = {**OCT, "label": "penyok"}
    response = export(client, {"format": "xlsx", "filters": filters})

    workbook = load_workbook(BytesIO(response.content))
    rows = list(workbook["Data"].iter_rows(min_row=2, values_only=True))
    listing = client.get(
        "/api/riwayat",
        params={"page_size": 1, **filters},
        headers=auth_headers(client, "budi"),
    ).json()

    assert len(rows) == listing["total"] > 0
    assert {row[4] for row in rows} == {"Penyok"}


# F8-T4
def test_pdf_has_header_and_summary(client):
    response = export(client, {"format": "pdf", "filters": OCT}, username="siti")
    text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(response.content)).pages)

    assert "Laporan Inspeksi Cacat Kemasan" in text
    assert "Total inspeksi" in text
    assert "Rincian cacat" in text
    assert "Penyok" in text
    assert "Budi Santoso" in text


# F8-T5
def test_excel_has_data_and_summary_sheets(client):
    response = export(client, {"format": "xlsx", "filters": OCT})
    workbook = load_workbook(BytesIO(response.content))

    assert workbook.sheetnames == ["Data", "Ringkasan"]
    summary = {
        row[0]: row[1]
        for row in workbook["Ringkasan"].iter_rows(min_row=1, values_only=True)
        if row and row[0]
    }
    assert summary["Total inspeksi"] == 128
    assert summary["Cacat"] == 37


# F8-T6
def test_export_empty_period(client):
    filters = {"start_date": "2026-09-01", "end_date": "2026-09-02"}

    pdf = export(client, {"format": "pdf", "filters": filters})
    xlsx = export(client, {"format": "xlsx", "filters": filters})

    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    workbook = load_workbook(BytesIO(xlsx.content))
    assert workbook["Data"].max_row == 1
    summary = {
        row[0]: row[1]
        for row in workbook["Ringkasan"].iter_rows(min_row=1, values_only=True)
        if row and row[0]
    }
    assert summary["Total inspeksi"] == 0


# F8-T7
@pytest.mark.parametrize("format_value", ["docx", "csv", "", None])
def test_invalid_format_rejected(client, format_value):
    response = export(client, {"format": format_value, "filters": OCT})
    assert response.status_code == 422


# F8-T8
def test_export_role_access(client):
    assert export(client, {"format": "pdf", "filters": OCT}, "budi").status_code == 200
    assert export(client, {"format": "xlsx", "filters": OCT}, "siti").status_code == 200

    admin = export(client, {"format": "pdf", "filters": OCT}, "andi")
    assert admin.status_code == 403
    assert admin.json() == {"detail": "Akses ditolak"}


def test_export_without_token(client):
    assert client.post("/api/riwayat/export", json={"format": "pdf"}).status_code == 401


def test_export_invalid_filters_rejected(client):
    response = export(
        client,
        {"format": "pdf", "filters": {"start_date": "2026-10-29", "end_date": "2026-10-01"}},
    )
    assert response.status_code == 422
