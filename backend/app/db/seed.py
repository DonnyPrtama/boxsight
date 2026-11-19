"""Seed data awal: akun TEST_CREDENTIALS.md, setting threshold, dan data demo Oktober 2026."""

import random
from datetime import datetime, timedelta

from PIL import Image, ImageDraw
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import BoundingBox, Gambar, HasilDeteksi, Inspeksi, Setting, User
from app.db.session import SessionLocal, engine
from app.services.status import (
    DB_PERLU_REVIEW,
    DB_SELESAI,
    DB_TERSIMPAN,
)

SEED_PASSWORD = "gudang04"

# (nama, username, role) sesuai TEST_CREDENTIALS.md
SEED_USERS: tuple[tuple[str, str, str], ...] = (
    ("Budi Santoso", "budi", "OPERATOR"),
    ("Rina Wulandari", "rina", "OPERATOR"),
    ("Siti Rahma", "siti", "MANAJEMEN"),
    ("Dewi Lestari", "dewi", "MANAJEMEN"),
    ("Andi Pratama", "andi", "ADMIN"),
    ("Agus Setiawan", "agus", "ADMIN"),
)

DEFAULT_THRESHOLD = 0.75
# 2026-10-20 09:15 WIB, sama dengan DEFAULT_THRESHOLD di frontend/src/lib/settings.ts.
DEFAULT_THRESHOLD_UPDATED_AT = datetime(2026, 10, 20, 2, 15)

DEMO_SEED = 20261001
DEMO_OPERATORS = ("budi", "rina")
DEMO_TIMES = ("08.15", "10.40", "13.05", "15.30", "17.55")
DEMO_LABELS = ("penyok", "robek", "label_rusak")
DEMO_IMAGE_URL = "/api/files/2026/10/seed_demo.jpg"
WIB_OFFSET = timedelta(hours=7)


def _demo_timestamp(day: int, time_text: str) -> datetime:
    hour, minute = (int(part) for part in time_text.split("."))
    wib = datetime(2026, 10, day, hour, minute)
    return wib - WIB_OFFSET


def _ensure_placeholder_image() -> None:
    """Satu gambar netral yang dipakai semua record demo, supaya detail tidak 404."""
    settings = get_settings()
    target = settings.storage_dir / "2026" / "10" / "seed_demo.jpg"
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)

    image = Image.new("RGB", (800, 600), (233, 226, 214))
    draw = ImageDraw.Draw(image)
    draw.rectangle((140, 120, 660, 480), fill=(206, 192, 172), outline=(150, 132, 108), width=6)
    draw.line((140, 120, 660, 480), fill=(176, 158, 132), width=4)
    image.save(target, format="JPEG", quality=85)


def _generic_specs(rng: random.Random) -> list[dict]:
    kinds = ["clean"] * 81 + ["defect"] * 32 + ["reviewed"] * 3 + ["review"] * 8
    rng.shuffle(kinds)

    specs: list[dict] = []
    for index, kind in enumerate(kinds):
        source = "UPLOAD" if index % 2 == 0 else "KAMERA"
        label = None if kind == "clean" else rng.choice(DEMO_LABELS)
        if kind == "clean":
            confidence = round(rng.uniform(0.92, 0.99), 2)
            status = DB_SELESAI
        elif kind == "defect":
            confidence = round(rng.uniform(0.82, 0.97), 2)
            status = DB_SELESAI
        else:
            confidence = round(rng.uniform(0.55, 0.72), 2)
            status = DB_TERSIMPAN if kind == "reviewed" else DB_PERLU_REVIEW

        reviewed = kind == "reviewed"
        specs.append(
            {
                "day": rng.randint(1, 28),
                "time": rng.choice(DEMO_TIMES),
                "operator": rng.choice(DEMO_OPERATORS),
                "source": source,
                "label": label,
                "confidence": confidence,
                "status": status,
                "perlu_review": kind in ("review", "reviewed"),
                "status_review": "SELESAI" if reviewed else "MENUNGGU",
                "keputusan_manual": "CACAT" if reviewed else None,
                "catatan": "Dikonfirmasi saat review manual." if reviewed else None,
                "bbox": None if kind == "clean" else _demo_bbox(rng),
                "file": f"kemasan_{index + 20:03d}.jpg"
                if source == "UPLOAD"
                else f"foto_inspeksi_{index + 10:02d}.jpg",
                "ukuran": rng.randint(900_000, 1_500_000),
            }
        )
    return specs


def _demo_bbox(rng: random.Random) -> tuple[float, float, float, float]:
    lebar = round(rng.uniform(0.2, 0.4), 4)
    tinggi = round(rng.uniform(0.2, 0.4), 4)
    x = round(rng.uniform(0.1, 0.9 - lebar), 4)
    y = round(rng.uniform(0.1, 0.9 - tinggi), 4)
    return x, y, lebar, tinggi


# Empat record terakhir harus menempati id 125-128, karena route uji frontend
# memakai /history/125 sampai /history/128.
EXPLICIT_SPECS: tuple[dict, ...] = (
    {
        "day": 28,
        "time": "16.20",
        "operator": "budi",
        "source": "UPLOAD",
        "label": "robek",
        "confidence": 0.58,
        "status": DB_PERLU_REVIEW,
        "perlu_review": True,
        "status_review": "MENUNGGU",
        "keputusan_manual": None,
        "catatan": None,
        "bbox": (0.31, 0.22, 0.28, 0.34),
        "file": "kemasan_012.jpg",
        "ukuran": 1_258_291,
    },
    {
        "day": 29,
        "time": "11.45",
        "operator": "rina",
        "source": "UPLOAD",
        "label": None,
        "confidence": 0.95,
        "status": DB_SELESAI,
        "perlu_review": False,
        "status_review": "MENUNGGU",
        "keputusan_manual": None,
        "catatan": None,
        "bbox": None,
        "file": "kemasan_009.jpg",
        "ukuran": 1_153_433,
    },
    {
        "day": 29,
        "time": "13.10",
        "operator": "budi",
        "source": "KAMERA",
        "label": "robek",
        "confidence": 0.62,
        "status": DB_TERSIMPAN,
        "perlu_review": True,
        "status_review": "SELESAI",
        "keputusan_manual": "CACAT",
        "catatan": "Robekan terlihat jelas",
        "bbox": (0.24, 0.18, 0.33, 0.29),
        "file": "foto_inspeksi_02.jpg",
        "ukuran": 1_468_006,
    },
    {
        "day": 29,
        "time": "14.32",
        "operator": "budi",
        "source": "UPLOAD",
        "label": "penyok",
        "confidence": 0.91,
        "status": DB_SELESAI,
        "perlu_review": False,
        "status_review": "MENUNGGU",
        "keputusan_manual": None,
        "catatan": None,
        "bbox": (0.21, 0.33, 0.4, 0.28),
        "file": "kemasan_014.jpg",
        "ukuran": 1_258_291,
    },
)


def seed_users(db: Session) -> int:
    created = 0
    for nama, username, role in SEED_USERS:
        exists = db.scalar(select(User.id).where(User.username == username))
        if exists is not None:
            continue
        db.add(
            User(
                nama=nama,
                username=username,
                password_hash=hash_password(SEED_PASSWORD),
                role=role,
            )
        )
        created += 1
    db.commit()
    return created


def seed_settings(db: Session) -> bool:
    if db.scalar(select(Setting.id)) is not None:
        return False
    db.add(
        Setting(
            threshold_confidence=DEFAULT_THRESHOLD,
            diperbarui_pada=DEFAULT_THRESHOLD_UPDATED_AT,
        )
    )
    db.commit()
    return True


def seed_inspeksi(db: Session) -> int:
    if db.scalar(select(Inspeksi.id).limit(1)) is not None:
        return 0

    operator_ids = {
        user.username: user.id
        for user in db.scalars(select(User).where(User.username.in_(DEMO_OPERATORS))).all()
    }
    if len(operator_ids) < len(DEMO_OPERATORS):
        # Seed user belum jalan; jangan bikin inspeksi tanpa operator.
        return 0

    _ensure_placeholder_image()

    rng = random.Random(DEMO_SEED)
    specs = _generic_specs(rng) + list(EXPLICIT_SPECS)

    for spec in specs:
        hasil = HasilDeteksi(
            label=spec["label"],
            confidence=spec["confidence"],
            perlu_review=int(spec["perlu_review"]),
            status_review=spec["status_review"],
            keputusan_manual=spec["keputusan_manual"],
            catatan=spec["catatan"],
        )
        if spec["bbox"] is not None:
            x, y, lebar, tinggi = spec["bbox"]
            hasil.bounding_box = BoundingBox(x=x, y=y, lebar=lebar, tinggi=tinggi)

        db.add(
            Inspeksi(
                operator_id=operator_ids[spec["operator"]],
                timestamp=_demo_timestamp(spec["day"], spec["time"]),
                status=spec["status"],
                gambar=Gambar(
                    image_url=DEMO_IMAGE_URL,
                    nama_asli=spec["file"],
                    format="jpg",
                    ukuran=spec["ukuran"],
                    sumber=spec["source"],
                    dibuat_pada=_demo_timestamp(spec["day"], spec["time"]),
                ),
                hasil_deteksi=[hasil],
            )
        )

    db.commit()
    return len(specs)


def seed_all(db: Session) -> dict[str, int | bool]:
    return {
        "users_created": seed_users(db),
        "settings_created": seed_settings(db),
        "inspeksi_created": seed_inspeksi(db),
    }


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        result = seed_all(db)
    print(f"seed selesai: {result}")


if __name__ == "__main__":
    main()
