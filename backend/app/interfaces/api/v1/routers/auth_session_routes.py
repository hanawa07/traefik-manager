from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.interfaces.api.v1.routers.auth_sessions import (
    get_current_session_handler,
    list_sessions_handler,
    logout_all_sessions_handler,
    logout_handler,
    revoke_session_handler,
)
from app.interfaces.api.v1.schemas.auth_schemas import (
    CurrentSessionResponse,
    SessionListResponse,
)


@dataclass(frozen=True)
class AuthSessionEndpoints:
    get_current_session: Callable[..., Any]
    list_sessions: Callable[..., Any]
    logout: Callable[..., Any]
    logout_all_sessions: Callable[..., Any]
    revoke_session: Callable[..., Any]


def register_auth_session_routes(
    router: APIRouter,
    *,
    current_user_dependency: Callable[..., Any],
    auth_session_repository_factory_provider: Callable[[], Callable[[AsyncSession], Any]],
    clear_auth_cookies_func: Callable[[Response], None],
    to_session_response_func: Callable[[Any, str], Any],
) -> AuthSessionEndpoints:
    @router.get("/me", response_model=CurrentSessionResponse, summary="현재 로그인 세션")
    async def get_current_session(current_user: dict = Depends(current_user_dependency)):
        return await get_current_session_handler(current_user)

    @router.get("/sessions", response_model=SessionListResponse, summary="내 세션 목록")
    async def list_sessions(
        current_user: dict = Depends(current_user_dependency),
        db: AsyncSession = Depends(get_db),
    ):
        return await list_sessions_handler(
            current_user=current_user,
            db=db,
            auth_session_repository_factory=auth_session_repository_factory_provider(),
            to_session_response_func=to_session_response_func,
        )

    @router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="로그아웃")
    async def logout(
        response: Response,
        current_user: dict = Depends(current_user_dependency),
        db: AsyncSession = Depends(get_db),
    ):
        await logout_handler(
            response=response,
            current_user=current_user,
            db=db,
            auth_session_repository_factory=auth_session_repository_factory_provider(),
            clear_auth_cookies_func=clear_auth_cookies_func,
        )

    @router.post(
        "/logout-all",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="내 모든 세션 로그아웃",
    )
    async def logout_all_sessions(
        response: Response,
        current_user: dict = Depends(current_user_dependency),
        db: AsyncSession = Depends(get_db),
    ):
        await logout_all_sessions_handler(
            response=response,
            current_user=current_user,
            db=db,
            auth_session_repository_factory=auth_session_repository_factory_provider(),
            clear_auth_cookies_func=clear_auth_cookies_func,
        )

    @router.delete(
        "/sessions/{session_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="세션 종료",
    )
    async def revoke_session(
        session_id: str,
        response: Response,
        current_user: dict = Depends(current_user_dependency),
        db: AsyncSession = Depends(get_db),
    ):
        await revoke_session_handler(
            session_id=session_id,
            response=response,
            current_user=current_user,
            db=db,
            auth_session_repository_factory=auth_session_repository_factory_provider(),
            clear_auth_cookies_func=clear_auth_cookies_func,
        )

    return AuthSessionEndpoints(
        get_current_session=get_current_session,
        list_sessions=list_sessions,
        logout=logout,
        logout_all_sessions=logout_all_sessions,
        revoke_session=revoke_session,
    )
