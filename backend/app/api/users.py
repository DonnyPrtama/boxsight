from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import AuthenticatedUser, require_roles
from app.core.roles import ROLE_DB, role_label
from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.db.models import User
from app.db.session import get_db
from app.schemas.users import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

DUPLICATE_DETAIL = "Username sudah dipakai"


def _to_out(user: User) -> UserOut:
    return UserOut(id=user.id, nama=user.nama, username=user.username, role=role_label(user.role))


def _normalize_username(value: str) -> str:
    return value.strip().lower()


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _current: AuthenticatedUser = Depends(require_roles("ADMIN")),
) -> list[UserOut]:
    users = db.scalars(select(User).order_by(User.id)).all()
    return [_to_out(user) for user in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _current: AuthenticatedUser = Depends(require_roles("ADMIN")),
) -> UserOut:
    username = _normalize_username(payload.username)
    if db.scalar(select(User.id).where(User.username == username)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_DETAIL)

    user = User(
        nama=payload.nama.strip(),
        username=username,
        password_hash=hash_password(payload.password),
        role=ROLE_DB[payload.role],
        dibuat_pada=utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_out(user)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current: AuthenticatedUser = Depends(require_roles("ADMIN")),
) -> UserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User tidak ditemukan")

    username = _normalize_username(payload.username)
    clash = db.scalar(
        select(User.id).where(User.username == username, User.id != user_id)
    )
    if clash is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_DETAIL)

    new_role = ROLE_DB[payload.role]
    if user.id == current.user.id and new_role != "ADMIN":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Tidak bisa menurunkan role akun sendiri"
        )

    user.nama = payload.nama.strip()
    user.username = username
    user.role = new_role
    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return _to_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: AuthenticatedUser = Depends(require_roles("ADMIN")),
) -> Response:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User tidak ditemukan")
    if user.id == current.user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Tidak bisa menghapus akun sendiri")

    try:
        db.delete(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "User masih punya data inspeksi dan tidak bisa dihapus",
        ) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
