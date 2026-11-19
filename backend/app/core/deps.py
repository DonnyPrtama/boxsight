from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import InvalidTokenError, decode_access_token
from app.db.models import User
from app.db.session import get_db

UNAUTHORIZED_DETAIL = "Sesi tidak valid atau sudah berakhir"
FORBIDDEN_DETAIL = "Akses ditolak"

_bearer = HTTPBearer(auto_error=False)


@dataclass
class AuthenticatedUser:
    user: User
    expires_at: int  # epoch milidetik, siap dipakai frontend


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, UNAUTHORIZED_DETAIL)

    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, UNAUTHORIZED_DETAIL) from None

    subject = payload.get("sub")
    if subject is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, UNAUTHORIZED_DETAIL)

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, UNAUTHORIZED_DETAIL) from None

    user = db.get(User, user_id)
    if user is None or not user.aktif:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, UNAUTHORIZED_DETAIL)

    expires_at = int(payload["exp"]) * 1000
    return AuthenticatedUser(user=user, expires_at=expires_at)


def require_roles(*roles: str):
    """Dependency factory. roles berisi kode DB: OPERATOR, MANAJEMEN, ADMIN."""

    def dependency(
        current: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if current.user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, FORBIDDEN_DETAIL)
        return current

    return dependency
