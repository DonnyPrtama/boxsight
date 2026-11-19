from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.deteksi import InspectionOut


class RiwayatResponse(BaseModel):
    data: list[InspectionOut]
    total: int
    page: int
    page_size: int
    page_count: int


class ExportFilters(BaseModel):
    start_date: str | None = None
    end_date: str | None = None
    status: str | None = None
    label: str | None = None
    operator: str | None = None
    sumber: str | None = None


class ExportRequest(BaseModel):
    format: Literal["pdf", "xlsx"]
    filters: ExportFilters = Field(default_factory=ExportFilters)
