import logging
from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.schemas.auth_schemas import (
    CurrentSessionResponse,
    SessionListResponse,
)

logger = logging.getLogger(__name__)


async def get_current_session_handler(current_user: dict) -> CurrentSessionResponse:
    auth_session = current_user["session"]
    return CurrentSessionResponse(
        username=current_user["username"],
        role=current_user["role"],
        session_id=auth_session.id,
        issued_at=auth_session.issued_at,
        expires_at=auth_session.expires_at,
        idle_expires_at=auth_session.idle_expires_at,
    )


async def list_sessions_handler(
    *,
    current_user: dict,
    db: AsyncSession,
    auth_session_repository_factory: Callable[[AsyncSession], Any],
    to_session_response_func: Callable[[Any, str], Any],
) -> SessionListResponse:
    repository = auth_session_repository_factory(db)
    sessions = await repository.find_active_by_user_id(
        current_user["id"],
        datetime.now(timezone.utc),
    )
    return SessionListResponse(
        sessions=[to_session_response_func(session, current_user["session_id"]) for session in sessions]
    )


async def logout_handler(
    *,
    response: Response,
    current_user: dict,
    db: AsyncSession,
    auth_session_repository_factory: Callable[[AsyncSession], Any],
    clear_auth_cookies_func: Callable[[Response], None],
) -> None:
    auth_session = current_user["session"]
    auth_session.revoke("user_logout")
    await auth_session_repository_factory(db).save(auth_session)
    clear_auth_cookies_func(response)
    logger.info("로그아웃: username=%s", current_user["username"])


async def logout_all_sessions_handler(
    *,
    response: Response,
    current_user: dict,
    db: AsyncSession,
    auth_session_repository_factory: Callable[[AsyncSession], Any],
    clear_auth_cookies_func: Callable[[Response], None],
) -> None:
    repository = auth_session_repository_factory(db)
    revoked_at = datetime.now(timezone.utc)
    sessions = await repository.find_active_by_user_id(current_user["id"], revoked_at)
    for session in sessions:
        session.revoke("user_logout_all", revoked_at=revoked_at)
        await repository.save(session)
    clear_auth_cookies_func(response)
    logger.info("전체 로그아웃: username=%s count=%d", current_user["username"], len(sessions))


async def revoke_session_handler(
    *,
    session_id: str,
    response: Response,
    current_user: dict,
    db: AsyncSession,
    auth_session_repository_factory: Callable[[AsyncSession], Any],
    clear_auth_cookies_func: Callable[[Response], None],
) -> None:
    repository = auth_session_repository_factory(db)
    auth_session = await repository.find_by_id(session_id)
    if not auth_session or auth_session.user_id != current_user["id"] or auth_session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="세션을 찾을 수 없습니다")

    auth_session.revoke("user_logout_session")
    await repository.save(auth_session)
    if auth_session.id == current_user["session_id"]:
        clear_auth_cookies_func(response)
    logger.info("세션 종료: username=%s session_id=%s", current_user["username"], session_id)
