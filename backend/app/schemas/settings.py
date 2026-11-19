from pydantic import BaseModel, Field

from app.schemas.auth import CamelModel


class ThresholdUpdate(BaseModel):
    value: float = Field(ge=0.0, le=1.0)


class ThresholdResponse(CamelModel):
    value: float
    updated_at: str
