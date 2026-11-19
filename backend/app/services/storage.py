"""Penyimpanan gambar hasil upload."""

import hashlib
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.core.timeutil import utcnow

SUPPORTED_FORMATS = {"JPEG": ".jpg", "PNG": ".png"}
MAX_FILENAME_LENGTH = 255


class UploadValidationError(Exception):
    """File ditolak sebelum menyentuh disk."""


@dataclass(frozen=True)
class StoredImage:
    path: Path
    image_url: str
    format: str
    ukuran: int
    nama_asli: str


def _detect_format(data: bytes) -> str:
    try:
        with Image.open(BytesIO(data)) as image:
            image_format = image.format
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise UploadValidationError("File harus berupa gambar JPG atau PNG") from None

    if image_format not in SUPPORTED_FORMATS:
        raise UploadValidationError("File harus berupa gambar JPG atau PNG")
    return image_format


def _safe_original_name(raw_name: str | None) -> str:
    name = (raw_name or "").strip().replace("\\", "/").split("/")[-1]
    name = name[:MAX_FILENAME_LENGTH]
    return name or "tanpa-nama"


def save_image(data: bytes, original_name: str | None) -> StoredImage:
    settings = get_settings()
    image_format = _detect_format(data)
    extension = SUPPORTED_FORMATS[image_format]

    now = utcnow()
    relative_dir = Path(f"{now.year:04d}") / f"{now.month:02d}"
    # Nama file dari hash isi: upload gambar yang sama tidak memenuhi disk.
    filename = hashlib.sha256(data).hexdigest()[:20] + extension
    target = settings.storage_dir / relative_dir / filename
    target.parent.mkdir(parents=True, exist_ok=True)

    if not target.exists():
        target.write_bytes(data)

    image_url = f"/api/files/{relative_dir.as_posix()}/{filename}"
    return StoredImage(
        path=target,
        image_url=image_url,
        format=extension.lstrip("."),
        ukuran=len(data),
        nama_asli=_safe_original_name(original_name),
    )
