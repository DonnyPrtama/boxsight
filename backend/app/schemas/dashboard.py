from pydantic import BaseModel


class DefectCount(BaseModel):
    label: str
    count: int


class TrendPoint(BaseModel):
    date: str
    clean: int
    defect: int


class DashboardResponse(BaseModel):
    total: int
    cacat: int
    tidak_cacat: int
    review_manual: int
    defects: list[DefectCount]
    trend: list[TrendPoint]
