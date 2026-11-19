from typing import Literal

from pydantic import BaseModel, Field


class BoundingBoxOut(BaseModel):
    x: float
    y: float
    lebar: float
    tinggi: float


class ReviewRequest(BaseModel):
    keputusan: Literal["CACAT", "TIDAK_CACAT"]
    catatan: str | None = Field(default=None, max_length=500)


class InspectionOut(BaseModel):
    """DTO inspeksi. Sengaja snake_case, mengikuti kontrak di plan §7.3."""

    id: int
    display_id: str
    timestamp: str
    label: str | None
    confidence: float
    result: str | None
    status: str
    operator: str
    source: str
    file: str
    file_size: int
    image_url: str
    bounding_box: BoundingBoxOut | None
    review_decision: str | None
    review_note: str | None
