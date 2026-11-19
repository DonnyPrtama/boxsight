"""Konvensi waktu proyek.

Semua kolom timestamp disimpan sebagai UTC tanpa timezone (naive) di
TIMESTAMP WITHOUT TIME ZONE. Saat dikirim ke klien, nilai dikonversi ke WIB (+07:00)
dalam format ISO 8601.
"""

from datetime import datetime, timedelta, timezone

JAKARTA = timezone(timedelta(hours=7), "WIB")


def utcnow() -> datetime:
    """Waktu sekarang dalam UTC naive, siap disimpan ke kolom timestamp."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_jakarta_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(JAKARTA).isoformat(timespec="seconds")
