from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.session_security import parse_session_cookie, verify_session_secret
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_auth_session_repository import (
    SQLiteAuthSessionRepository,
)
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SESSION_TOUCH_INTERVAL = timedelta(minutes=1)


def _validate_csrf(request: Request) -> None:
    if request.method.upper() not in MUTATING_METHODS:
        return

    csrf_cookie = request.cookies.get(settings.SESSION_CSRF_COOKIE_NAME)
    csrf_header = request.headers.get("x-csrf-token")
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF 검증에 실패했습니다",
        )


def _validate_smoke_admin_read_only(request: Request, current_user: dict) -> None:
    if current_user["username"] != settings.SMOKE_ADMIN_USERNAME:
        return
    if request.method.upper() not in MUTATING_METHODS:
        return
    if request.url.path.startswith("/api/v1/auth/"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="전용 스모크 관리자 계정은 조회만 할 수 있습니다",
    )


async def resolve_authenticated_user(request: Request, db: AsyncSession):
    cookie_value = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not cookie_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다",
        )

    parsed_cookie = parse_session_cookie(cookie_value)
    if not parsed_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 세션입니다",
        )

    session_id, secret = parsed_cookie
    auth_session_repository = SQLiteAuthSessionRepository(db)
    auth_session = await auth_session_repository.find_by_id(session_id)
    if not auth_session or not verify_session_secret(secret, auth_session.session_secret_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 세션입니다",
        )

    now = datetime.now(timezone.utc)
    if not auth_session.is_active(now):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="만료된 세션입니다. 다시 로그인해주세요",
        )

    repository = SQLiteUserRepository(db)
    user = await repository.find_by_id(UUID(auth_session.user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 세션입니다",
        )

    if auth_session.token_version != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="만료된 세션입니다. 다시 로그인해주세요",
        )

    _validate_csrf(request)

    await _touch_auth_session_if_due(
        auth_session,
        repository=auth_session_repository,
        db=db,
        now=now,
    )
    return user, auth_session


async def _touch_auth_session_if_due(auth_session, *, repository, db, now: datetime) -> None:
    last_seen_at = auth_session.last_seen_at or auth_session.issued_at
    if now - last_seen_at < SESSION_TOUCH_INTERVAL:
        return
    auth_session.touch(
        now=now,
        idle_ttl=auth_session.idle_expires_at - last_seen_at,
    )
    await repository.save(auth_session)
    await db.commit()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, auth_session = await resolve_authenticated_user(request=request, db=db)

    current_user = {
        "id": str(user.id),
        "username": user.username,
        "role": user.role,
        "session_id": auth_session.id,
        "session": auth_session,
    }
    _validate_smoke_admin_read_only(request, current_user)
    return current_user


async def require_write_access(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="읽기 전용 계정은 변경 작업을 수행할 수 없습니다",
        )
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다",
        )
    return current_user
