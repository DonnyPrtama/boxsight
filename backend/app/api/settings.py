from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import AuthenticatedUser, get_current_user, require_roles
from app.core.timeutil import to_jakarta_iso, utcnow
from app.db.models import Setting
from app.db.seed import DEFAULT_THRESHOLD
from app.db.session import get_db
from app.schemas.settings import ThresholdResponse, ThresholdUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def get_or_create_setting(db: Session) -> Setting:
    """Ambil baris setting tunggal. Dibuat kalau belum ada, supaya endpoint tidak 500."""
    setting = db.scalar(select(Setting).order_by(Setting.id).limit(1))
    if setting is None:
        setting = Setting(threshold_confidence=DEFAULT_THRESHOLD)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def to_response(setting: Setting) -> ThresholdResponse:
    return ThresholdResponse(
        value=setting.threshold_confidence,
        updated_at=to_jakarta_iso(setting.diperbarui_pada),
    )


@router.get("/threshold", response_model=ThresholdResponse)
def get_threshold(
    db: Session = Depends(get_db),
    _current: AuthenticatedUser = Depends(get_current_user),
) -> ThresholdResponse:
    # Semua role boleh membaca: halaman Deteksi menampilkan threshold aktif.
    return to_response(get_or_create_setting(db))


@router.put("/threshold", response_model=ThresholdResponse)
def update_threshold(
    payload: ThresholdUpdate,
    db: Session = Depends(get_db),
    current: AuthenticatedUser = Depends(require_roles("ADMIN")),
) -> ThresholdResponse:
    setting = get_or_create_setting(db)
    setting.threshold_confidence = payload.value
    setting.diperbarui_pada = utcnow()
    setting.diperbarui_oleh = current.user.id
    db.commit()
    db.refresh(setting)
    # Threshold baru dipakai deteksi berikutnya; data lama tidak dihitung ulang.
    return to_response(setting)
