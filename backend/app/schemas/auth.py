from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(word.capitalize() for word in tail)


class CamelModel(BaseModel):
    """Model dengan alias camelCase, karena frontend memakai nama itu."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=256)


class SessionResponse(CamelModel):
    token: str
    username: str
    name: str
    role: str
    expires_at: int


class MeResponse(CamelModel):
    username: str
    name: str
    role: str
    expires_at: int
