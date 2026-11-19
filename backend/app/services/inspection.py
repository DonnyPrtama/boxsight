"""Mapping model database menjadi DTO yang dipakai frontend."""

from app.core.timeutil import to_jakarta_iso
from app.db.models import Inspeksi
from app.schemas.deteksi import BoundingBoxOut, InspectionOut
from app.services.status import result_label, status_label


def display_id(inspeksi_id: int) -> str:
    return f"INS-{inspeksi_id:03d}"


def to_inspection_dto(inspeksi: Inspeksi) -> InspectionOut:
    hasil = max(inspeksi.hasil_deteksi, key=lambda item: item.id, default=None)
    box = hasil.bounding_box if hasil is not None else None

    return InspectionOut(
        id=inspeksi.id,
        display_id=display_id(inspeksi.id),
        timestamp=to_jakarta_iso(inspeksi.timestamp),
        label=hasil.label if hasil else None,
        confidence=hasil.confidence if hasil else 1.0,
        result=(
            result_label(hasil.label, bool(hasil.perlu_review), hasil.keputusan_manual)
            if hasil
            else None
        ),
        status=(
            status_label(inspeksi.status, hasil.status_review if hasil else None)
            if hasil
            else "Final"
        ),
        operator=inspeksi.operator.nama,
        source=inspeksi.gambar.sumber,
        file=inspeksi.gambar.nama_asli,
        file_size=inspeksi.gambar.ukuran,
        image_url=inspeksi.gambar.image_url,
        bounding_box=(
            BoundingBoxOut(x=box.x, y=box.y, lebar=box.lebar, tinggi=box.tinggi)
            if box is not None
            else None
        ),
        review_decision=hasil.keputusan_manual if hasil else None,
        review_note=hasil.catatan if hasil else None,
    )
