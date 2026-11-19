from typing import Literal

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    nama: str
    username: str
    role: str


class UserCreate(BaseModel):
    nama: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=1, max_length=60)
    role: Literal["Operator", "Manajemen", "Admin"]
    password: str = Field(min_length=8, max_length=72)


class UserUpdate(BaseModel):
    nama: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=1, max_length=60)
    role: Literal["Operator", "Manajemen", "Admin"]
    password: str | None = Field(default=None, max_length=72)
