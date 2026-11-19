from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.models import HasilDeteksi, Inspeksi
from app.db.session import get_db
from app.schemas.dashboard import DashboardResponse, DefectCount, TrendPoint

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

WIB_OFFSET = timedelta(hours=7)
LABEL_ORDER = ("penyok", "robek", "label_rusak")


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


def _wib_date(value: datetime) -> str:
    return (value + WIB_OFFSET).date().isoformat()


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _current=Depends(require_roles("OPERATOR", "MANAJEMEN", "ADMIN")),
) -> DashboardResponse:
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

    rows = db.execute(
        select(
            Inspeksi.timestamp,
            HasilDeteksi.label,
            HasilDeteksi.perlu_review,
            HasilDeteksi.status_review,
            HasilDeteksi.keputusan_manual,
        )
        .join(HasilDeteksi, HasilDeteksi.inspeksi_id == Inspeksi.id)
        .where(*conditions)
    ).all()

    total = len(rows)
    cacat = 0
    tidak_cacat = 0
    review_manual = 0
    defect_counts: dict[str, int] = {label: 0 for label in LABEL_ORDER}
    trend: dict[str, dict[str, int]] = {}

    for timestamp, label, perlu_review, status_review, keputusan_manual in rows:
        is_defect: bool
        if perlu_review and status_review == "MENUNGGU":
            review_manual += 1
            # Review yang belum diputuskan belum masuk chart tren.
            continue
        if status_review == "SELESAI":
            is_defect = keputusan_manual == "CACAT"
        else:
            is_defect = label is not None

        if is_defect:
            cacat += 1
            if label in defect_counts:
                defect_counts[label] += 1
        else:
            tidak_cacat += 1

        day = _wib_date(timestamp)
        bucket = trend.setdefault(day, {"clean": 0, "defect": 0})
        bucket["defect" if is_defect else "clean"] += 1

    defects = [
        DefectCount(label=label, count=defect_counts[label])
        for label in LABEL_ORDER
        if defect_counts[label] > 0
    ]
    defects.sort(key=lambda item: item.count, reverse=True)

    return DashboardResponse(
        total=total,
        cacat=cacat,
        tidak_cacat=tidak_cacat,
        review_manual=review_manual,
        defects=defects,
        trend=[
            TrendPoint(date=day, clean=bucket["clean"], defect=bucket["defect"])
            for day, bucket in sorted(trend.items())
        ],
    )
