from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.settings import get_or_create_setting
from app.core.config import get_settings
from app.core.deps import AuthenticatedUser, require_roles
from app.core.timeutil import utcnow
from app.db.models import BoundingBox, Gambar, HasilDeteksi, Inspeksi
from app.db.session import get_db
from app.schemas.deteksi import InspectionOut, ReviewRequest
from app.services import inference
from app.services.inspection import to_inspection_dto
from app.services.storage import UploadValidationError, save_image
from app.services.status import DB_TERSIMPAN, apply_threshold

router = APIRouter(prefix="/deteksi", tags=["deteksi"])
files_router = APIRouter(tags=["files"])

SUMBER_MAP = {
    "upload": "UPLOAD",
    "camera": "KAMERA",
    "kamera": "KAMERA",
    "UPLOAD": "UPLOAD",
    "KAMERA": "KAMERA",
}


@router.post("/upload", response_model=InspectionOut)
async def upload_image(
    file: UploadFile = File(...),
    sumber: str = Form("upload"),
    db: Session = Depends(get_db),
    current: AuthenticatedUser = Depends(require_roles("OPERATOR")),
) -> InspectionOut:
    settings = get_settings()

    source = SUMBER_MAP.get(sumber)
    if source is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Sumber gambar tidak dikenal")

    raw = await file.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Ukuran file melebihi batas 5 MB"
        )

    try:
        stored = save_image(raw, file.filename)
    except UploadValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None

    threshold = get_or_create_setting(db).threshold_confidence
    detections = inference.detect(stored.path)
    decision = apply_threshold(detections, threshold)

    gambar = Gambar(
        image_url=stored.image_url,
        format=stored.format,
        ukuran=stored.ukuran,
        sumber=source,
        nama_asli=stored.nama_asli,
        dibuat_pada=utcnow(),
    )
    db.add(gambar)
    db.flush()

    inspeksi = Inspeksi(
        operator_id=current.user.id,
        gambar_id=gambar.id,
        timestamp=utcnow(),
        status=decision.inspeksi_status,
    )
    db.add(inspeksi)
    db.flush()

    hasil = HasilDeteksi(
        inspeksi_id=inspeksi.id,
        label=decision.label,
        confidence=decision.confidence,
        perlu_review=int(decision.perlu_review),
        status_review=decision.status_review,
    )
    db.add(hasil)
    db.flush()

    top = max(detections, key=lambda item: item.confidence, default=None)
    if top is not None:
        x, y, lebar, tinggi = top.bbox
        db.add(
            BoundingBox(
                hasil_deteksi_id=hasil.id,
                x=x,
                y=y,
                lebar=lebar,
                tinggi=tinggi,
            )
        )

    db.commit()
    db.refresh(inspeksi)
    return to_inspection_dto(inspeksi)


@router.post("/{inspeksi_id}/review", response_model=InspectionOut)
def review_manual(
    inspeksi_id: int,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    current: AuthenticatedUser = Depends(require_roles("OPERATOR")),
) -> InspectionOut:
    inspeksi = db.get(Inspeksi, inspeksi_id)
    if inspeksi is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inspeksi tidak ditemukan")

    hasil = max(inspeksi.hasil_deteksi, key=lambda item: item.id, default=None)
    if hasil is None or not hasil.perlu_review:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Hasil ini tidak memerlukan review manual"
        )
    if hasil.status_review == "SELESAI":
        raise HTTPException(status.HTTP_409_CONFLICT, "Hasil sudah direview")

    # Confidence tidak diubah: nilai model tetap tersimpan sebagai jejak audit.
    hasil.keputusan_manual = payload.keputusan
    hasil.catatan = (payload.catatan or "").strip() or None
    hasil.status_review = "SELESAI"
    hasil.direview_oleh = current.user.id
    hasil.direview_pada = utcnow()
    inspeksi.status = DB_TERSIMPAN

    db.commit()
    db.refresh(inspeksi)
    return to_inspection_dto(inspeksi)


@router.get("/{inspeksi_id}", response_model=InspectionOut)
def get_detection(
    inspeksi_id: int,
    db: Session = Depends(get_db),
    _current: AuthenticatedUser = Depends(require_roles("OPERATOR", "MANAJEMEN", "ADMIN")),
) -> InspectionOut:
    inspeksi = db.get(Inspeksi, inspeksi_id)
    if inspeksi is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inspeksi tidak ditemukan")
    return to_inspection_dto(inspeksi)


@files_router.get("/files/{file_path:path}")
def get_file(file_path: str) -> FileResponse:
    settings = get_settings()
    root = settings.storage_dir.resolve()
    target = (root / file_path).resolve()

    # Tolak path yang keluar dari folder storage.
    if not target.is_relative_to(root) or not target.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File tidak ditemukan")

    return FileResponse(Path(target))
