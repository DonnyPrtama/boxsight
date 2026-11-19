from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.models import LABEL_VALUES, Gambar, HasilDeteksi, Inspeksi, User
from app.db.session import get_db
from app.schemas.deteksi import InspectionOut
from app.schemas.riwayat import ExportRequest, RiwayatResponse
from app.services.inspection import to_inspection_dto
from app.services.report import generate_excel, generate_pdf
from app.services.status import DB_PERLU_REVIEW, DB_SELESAI

router = APIRouter(prefix="/riwayat", tags=["riwayat"])

WIB_OFFSET = timedelta(hours=7)
DEFAULT_PAGE_SIZE = 5
MAX_PAGE_SIZE = 100

STATUS_FILTERS = {
    "final": "final",
    "review": "review",
    "reviewed": "reviewed",
    "perlu review": "review",
    "sudah direview": "reviewed",
}

SUMBER_FILTERS = {
    "upload": "UPLOAD",
    "kamera": "KAMERA",
    "camera": "KAMERA",
    "UPLOAD": "UPLOAD",
    "KAMERA": "KAMERA",
}


def _parse_date(value: str | None, field: str) -> date | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Format {field} harus YYYY-MM-DD",
        ) from None


def _start_of_day_utc(value: date) -> datetime:
    return datetime(value.year, value.month, value.day) - WIB_OFFSET


def _with_joins(statement: Select) -> Select:
    return (
        statement.join(HasilDeteksi, HasilDeteksi.inspeksi_id == Inspeksi.id)
        .join(User, User.id == Inspeksi.operator_id)
        .join(Gambar, Gambar.id == Inspeksi.gambar_id)
    )


def build_conditions(
    start_date: str | None,
    end_date: str | None,
    status_filter: str | None,
    label: str | None,
    operator: str | None,
    sumber: str | None,
) -> list:
    """Validasi filter dan ubah menjadi kondisi SQL. Dipakai riwayat dan export."""
    start = _parse_date(start_date, "start_date")
    end = _parse_date(end_date, "end_date")
    if start and end and start > end:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "start_date tidak boleh setelah end_date"
        )

    conditions = []
    if start is not None:
        conditions.append(Inspeksi.timestamp >= _start_of_day_utc(start))
    if end is not None:
        conditions.append(Inspeksi.timestamp < _start_of_day_utc(end + timedelta(days=1)))

    if status_filter:
        normalized = STATUS_FILTERS.get(status_filter.strip().lower())
        if normalized is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "status harus salah satu: final, review, reviewed",
            )
        if normalized == "final":
            conditions.append(Inspeksi.status == DB_SELESAI)
            conditions.append(HasilDeteksi.status_review != "SELESAI")
        elif normalized == "review":
            conditions.append(Inspeksi.status == DB_PERLU_REVIEW)
            conditions.append(HasilDeteksi.status_review == "MENUNGGU")
        else:
            conditions.append(HasilDeteksi.status_review == "SELESAI")

    if label:
        if label not in LABEL_VALUES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "label harus salah satu: " + ", ".join(LABEL_VALUES),
            )
        conditions.append(HasilDeteksi.label == label)

    if operator:
        conditions.append(User.username == operator.strip().lower())

    if sumber:
        source = SUMBER_FILTERS.get(sumber)
        if source is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "sumber harus upload atau camera"
            )
        conditions.append(Gambar.sumber == source)

    return conditions


@router.get("", response_model=RiwayatResponse)
@router.get("/", response_model=RiwayatResponse, include_in_schema=False)
def list_riwayat(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    start_date: str | None = None,
    end_date: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    label: str | None = None,
    operator: str | None = None,
    sumber: str | None = None,
    db: Session = Depends(get_db),
    _current=Depends(require_roles("OPERATOR", "MANAJEMEN")),
) -> RiwayatResponse:
    conditions = build_conditions(
        start_date, end_date, status_filter, label, operator, sumber
    )

    total = db.scalar(
        _with_joins(select(func.count(Inspeksi.id)).select_from(Inspeksi)).where(*conditions)
    )
    total = int(total or 0)

    query = _with_joins(select(Inspeksi)).where(*conditions)
    query = (
        query.order_by(Inspeksi.timestamp.desc(), Inspeksi.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = db.scalars(query).unique().all()

    page_count = (total + page_size - 1) // page_size
    return RiwayatResponse(
        data=[to_inspection_dto(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        page_count=page_count,
    )


@router.post("/export")
def export_laporan(
    payload: ExportRequest,
    db: Session = Depends(get_db),
    _current=Depends(require_roles("OPERATOR", "MANAJEMEN")),
) -> Response:
    filters = payload.filters
    conditions = build_conditions(
        filters.start_date,
        filters.end_date,
        filters.status,
        filters.label,
        filters.operator,
        filters.sumber,
    )
    rows = list(
        db.scalars(
            _with_joins(select(Inspeksi))
            .where(*conditions)
            .order_by(Inspeksi.timestamp.asc(), Inspeksi.id.asc())
        )
        .unique()
        .all()
    )

    if payload.format == "pdf":
        content = generate_pdf(rows)
        media_type = "application/pdf"
        extension = "pdf"
    else:
        content = generate_excel(rows)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="Laporan_inspeksi.{extension}"',
            "Content-Length": str(len(content)),
        },
    )


@router.get("/{inspeksi_id}", response_model=InspectionOut)
def get_riwayat_detail(
    inspeksi_id: int,
    db: Session = Depends(get_db),
    _current=Depends(require_roles("OPERATOR", "MANAJEMEN")),
) -> InspectionOut:
    inspeksi = db.get(Inspeksi, inspeksi_id)
    if inspeksi is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inspeksi tidak ditemukan")
    return to_inspection_dto(inspeksi)
