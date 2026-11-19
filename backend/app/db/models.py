from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timeutil import utcnow
from app.db.base import Base

ROLE_VALUES = ("OPERATOR", "MANAJEMEN", "ADMIN")
SUMBER_GAMBAR_VALUES = ("UPLOAD", "KAMERA")
STATUS_INSPEKSI_VALUES = (
    "DIUNGGAH",
    "DIVALIDASI",
    "DITOLAK",
    "DIPROSES",
    "SELESAI",
    "PERLU_REVIEW_MANUAL",
    "TERSIMPAN",
)
LABEL_VALUES = ("penyok", "robek", "label_rusak")
KEPUTUSAN_VALUES = ("CACAT", "TIDAK_CACAT")
STATUS_REVIEW_VALUES = ("MENUNGGU", "SELESAI")


def _check_in(column: str, values: tuple[str, ...]) -> str:
    joined = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({joined})"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nama: Mapped[str] = mapped_column(String(120), nullable=False)
    username: Mapped[str] = mapped_column(String(60), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    aktif: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    __table_args__ = (CheckConstraint(_check_in("role", ROLE_VALUES), name="ck_users_role"),)


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    threshold_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.75)
    diperbarui_pada: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    diperbarui_oleh: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "threshold_confidence >= 0 AND threshold_confidence <= 1",
            name="ck_settings_threshold_range",
        ),
    )


class Gambar(Base):
    __tablename__ = "gambar"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    image_url: Mapped[str] = mapped_column(String(255), nullable=False)
    nama_asli: Mapped[str] = mapped_column(String(255), nullable=False, default="tanpa-nama")
    format: Mapped[str] = mapped_column(String(10), nullable=False)
    ukuran: Mapped[int] = mapped_column(Integer, nullable=False)
    sumber: Mapped[str] = mapped_column(String(10), nullable=False)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    __table_args__ = (
        CheckConstraint(_check_in("sumber", SUMBER_GAMBAR_VALUES), name="ck_gambar_sumber"),
    )


class Inspeksi(Base):
    __tablename__ = "inspeksi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    operator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    gambar_id: Mapped[int] = mapped_column(
        ForeignKey("gambar.id", ondelete="RESTRICT"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    status: Mapped[str] = mapped_column(String(30), nullable=False)

    operator: Mapped[User] = relationship(lazy="joined")
    gambar: Mapped[Gambar] = relationship(lazy="joined")
    hasil_deteksi: Mapped[list["HasilDeteksi"]] = relationship(
        back_populates="inspeksi", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        CheckConstraint(_check_in("status", STATUS_INSPEKSI_VALUES), name="ck_inspeksi_status"),
        Index("ix_inspeksi_timestamp", "timestamp"),
        Index("ix_inspeksi_operator_id", "operator_id"),
        Index("ix_inspeksi_status", "status"),
    )


class HasilDeteksi(Base):
    __tablename__ = "hasil_deteksi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inspeksi_id: Mapped[int] = mapped_column(
        ForeignKey("inspeksi.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    perlu_review: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status_review: Mapped[str] = mapped_column(String(15), nullable=False, default="MENUNGGU")
    keputusan_manual: Mapped[str | None] = mapped_column(String(15), nullable=True)
    catatan: Mapped[str | None] = mapped_column(Text, nullable=True)
    direview_oleh: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    direview_pada: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    inspeksi: Mapped[Inspeksi] = relationship(back_populates="hasil_deteksi")
    bounding_box: Mapped["BoundingBox | None"] = relationship(
        back_populates="hasil_deteksi", cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        CheckConstraint(
            f"label IS NULL OR {_check_in('label', LABEL_VALUES)}", name="ck_hasil_label"
        ),
        CheckConstraint(
            "confidence >= 0 AND confidence <= 1", name="ck_hasil_confidence_range"
        ),
        CheckConstraint(_check_in("status_review", STATUS_REVIEW_VALUES), name="ck_hasil_review"),
        CheckConstraint(
            "keputusan_manual IS NULL OR "
            + _check_in("keputusan_manual", KEPUTUSAN_VALUES),
            name="ck_hasil_keputusan",
        ),
        Index("ix_hasil_deteksi_inspeksi_id", "inspeksi_id"),
        Index("ix_hasil_deteksi_label", "label"),
    )


class BoundingBox(Base):
    __tablename__ = "bounding_box"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hasil_deteksi_id: Mapped[int] = mapped_column(
        ForeignKey("hasil_deteksi.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    lebar: Mapped[float] = mapped_column(Float, nullable=False)
    tinggi: Mapped[float] = mapped_column(Float, nullable=False)

    hasil_deteksi: Mapped[HasilDeteksi] = relationship(back_populates="bounding_box")

    __table_args__ = (
        CheckConstraint("x >= 0 AND x <= 1", name="ck_bbox_x"),
        CheckConstraint("y >= 0 AND y <= 1", name="ck_bbox_y"),
        CheckConstraint("lebar > 0 AND lebar <= 1", name="ck_bbox_lebar"),
        CheckConstraint("tinggi > 0 AND tinggi <= 1", name="ck_bbox_tinggi"),
    )
