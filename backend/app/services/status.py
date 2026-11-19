"""Aturan confidence terhadap threshold, sesuai plan §3 dan diagram 4.2/4.4."""

from dataclasses import dataclass

from app.services.inference import Detection

RESULT_CACAT = "Cacat"
RESULT_BERSIH = "Tidak cacat"

STATUS_FINAL = "Final"
STATUS_PERLU_REVIEW = "Perlu review"
STATUS_SUDAH_REVIEW = "Sudah direview"

# Nilai enum StatusInspeksi (diagram 4.2)
DB_SELESAI = "SELESAI"
DB_PERLU_REVIEW = "PERLU_REVIEW_MANUAL"
DB_TERSIMPAN = "TERSIMPAN"


@dataclass(frozen=True)
class ThresholdDecision:
    label: str | None
    confidence: float
    perlu_review: bool
    inspeksi_status: str
    status_review: str
    result: str | None


def apply_threshold(detections: list[Detection], threshold: float) -> ThresholdDecision:
    """Tentukan hasil akhir dari deteksi mentah dan threshold aktif."""
    top = max(detections, key=lambda item: item.confidence, default=None)

    if top is None:
        # Tidak ada cacat terdeteksi: dianggap bersih dan final.
        return ThresholdDecision(
            label=None,
            confidence=1.0,
            perlu_review=False,
            inspeksi_status=DB_SELESAI,
            status_review="MENUNGGU",
            result=RESULT_BERSIH,
        )

    if top.confidence >= threshold:
        return ThresholdDecision(
            label=top.label,
            confidence=top.confidence,
            perlu_review=False,
            inspeksi_status=DB_SELESAI,
            status_review="MENUNGGU",
            result=RESULT_CACAT,
        )

    return ThresholdDecision(
        label=top.label,
        confidence=top.confidence,
        perlu_review=True,
        inspeksi_status=DB_PERLU_REVIEW,
        status_review="MENUNGGU",
        result=None,
    )


def status_label(inspeksi_status: str, status_review: str | None) -> str:
    """Mapping enum DB -> string tampilan frontend (plan §4)."""
    if status_review == "SELESAI":
        return STATUS_SUDAH_REVIEW
    if inspeksi_status == DB_PERLU_REVIEW:
        return STATUS_PERLU_REVIEW
    return STATUS_FINAL


def result_label(
    label: str | None,
    perlu_review: bool,
    keputusan_manual: str | None,
) -> str | None:
    if keputusan_manual == "CACAT":
        return RESULT_CACAT
    if keputusan_manual == "TIDAK_CACAT":
        return RESULT_BERSIH
    if perlu_review:
        return None
    return RESULT_CACAT if label else RESULT_BERSIH
