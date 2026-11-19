"""Inferensi cacat kemasan.

Dua backend: `yolo` memakai bobot YOLOv8 di `model/weights`, `stub` dipakai tes supaya
hasil deterministik dan tidak butuh torch. Kontrak keduanya sama:
`detect(path) -> list[Detection]`.
"""

import hashlib
import random
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

# Urutan label terkunci, lihat plan §2.
LABELS: tuple[str, ...] = ("penyok", "robek", "label_rusak")

# Ambang model: deteksi di bawah ini tidak dianggap ada.
MODEL_CONFIDENCE_FLOOR = 0.25
MODEL_IMGSZ = 960

# Porsi gambar bersih pada stub supaya kedua cabang aturan threshold teruji.
CLEAN_RATIO = 0.25


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    bbox: tuple[float, float, float, float]  # x, y, lebar, tinggi (0..1)


def _normalize_box(
    xyxy: tuple[float, float, float, float],
    width: int,
    height: int,
) -> tuple[float, float, float, float] | None:
    """Ubah kotak piksel YOLO menjadi x, y, lebar, tinggi ternormalisasi."""
    if width <= 0 or height <= 0:
        return None

    x1, y1, x2, y2 = xyxy
    x1 = max(0.0, min(float(width), x1))
    y1 = max(0.0, min(float(height), y1))
    x2 = max(0.0, min(float(width), x2))
    y2 = max(0.0, min(float(height), y2))
    if x2 <= x1 or y2 <= y1:
        return None

    x = round(x1 / width, 4)
    y = round(y1 / height, 4)
    lebar = round((x2 - x1) / width, 4)
    tinggi = round((y2 - y1) / height, 4)
    # Kolom DB punya check lebar > 0 dan tinggi > 0.
    if lebar <= 0 or tinggi <= 0:
        return None
    return x, y, lebar, tinggi


@lru_cache(maxsize=1)
def _load_model():
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise RuntimeError(
            "Ultralytics belum terpasang. Jalankan pip install -r requirements.txt."
        ) from exc

    path = get_settings().model_path
    if not path.is_file():
        raise RuntimeError(f"Bobot model tidak ditemukan: {path}")
    return YOLO(str(path))


def ensure_model_ready() -> None:
    """Gagal cepat saat startup kalau bobot atau dependency model tidak siap."""
    _load_model()


def _seed_for(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return f"{get_settings().stub_seed}:{digest}"


def _stub_bbox(rng: random.Random) -> tuple[float, float, float, float]:
    lebar = round(rng.uniform(0.18, 0.42), 4)
    tinggi = round(rng.uniform(0.18, 0.42), 4)
    x = round(rng.uniform(0.05, 1.0 - lebar - 0.05), 4)
    y = round(rng.uniform(0.05, 1.0 - tinggi - 0.05), 4)
    return x, y, lebar, tinggi


def _stub_detect(image_path: Path) -> list[Detection]:
    rng = random.Random(_seed_for(image_path))

    if rng.random() < CLEAN_RATIO:
        return []

    confidence = round(rng.uniform(0.45, 0.98), 4)
    if confidence < MODEL_CONFIDENCE_FLOOR:
        return []

    return [
        Detection(
            label=rng.choice(LABELS),
            confidence=confidence,
            bbox=_stub_bbox(rng),
        )
    ]


def _yolo_detect(image_path: Path) -> list[Detection]:
    result = _load_model().predict(
        str(image_path),
        conf=MODEL_CONFIDENCE_FLOOR,
        imgsz=MODEL_IMGSZ,
        verbose=False,
    )[0]
    height, width = result.orig_shape

    detections: list[Detection] = []
    for box in result.boxes:
        bbox = _normalize_box(
            tuple(float(value) for value in box.xyxy[0]),
            width,
            height,
        )
        if bbox is None:
            continue
        detections.append(
            Detection(
                label=LABELS[int(box.cls[0])],
                confidence=round(float(box.conf[0]), 4),
                bbox=bbox,
            )
        )

    detections.sort(key=lambda item: item.confidence, reverse=True)
    return detections


def detect(image_path: Path) -> list[Detection]:
    if get_settings().inference_backend == "yolo":
        return _yolo_detect(image_path)
    return _stub_detect(image_path)
