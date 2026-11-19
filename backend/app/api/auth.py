from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import AuthenticatedUser, get_current_user
from app.core.roles import role_label
from app.core.security import create_access_token, verify_password
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, MeResponse, SessionResponse

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_ERROR = "Username atau password salah"


@router.post("/login", response_model=SessionResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> SessionResponse:
    username = payload.username.strip().lower()
    user = db.scalar(select(User).where(User.username == username))

    # Pesan error sengaja sama untuk user tidak ada dan password salah (sequence 2.1).
    if user is None or not user.aktif or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, LOGIN_ERROR)

    token, expires_at = create_access_token(user.id, user.username, user.role)
    return SessionResponse(
        token=token,
        username=user.username,
        name=user.nama,
        role=role_label(user.role),
        expires_at=int(expires_at.timestamp()) * 1000,
    )


@router.get("/me", response_model=MeResponse)
def me(current: AuthenticatedUser = Depends(get_current_user)) -> MeResponse:
    user = current.user
    return MeResponse(
        username=user.username,
        name=user.nama,
        role=role_label(user.role),
        expires_at=current.expires_at,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    # JWT bersifat stateless: logout cukup membuang token di sisi klien.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
