import logging
from datetime import timedelta
from typing import Any, Callable

from fastapi import Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_client_ip
from app.domain.auth.entities.auth_session import AuthSession

logger = logging.getLogger(__name__)


async def issue_successful_login_session(
    *,
    request: Request,
    response: Response,
    user,
    db: AsyncSession,
    auth_session_repository_factory: Callable[[AsyncSession], Any],
    issue_session_credentials_func: Callable[[], Any],
    issue_csrf_token_func: Callable[[], str],
    set_auth_cookies_func: Callable[[Response, str, str], None],
    settings_obj: Any,
) -> dict[str, str]:
    credentials = issue_session_credentials_func()
    csrf_token = issue_csrf_token_func()
    auth_session = AuthSession.issue(
        session_id=credentials.session_id,
        session_secret_hash=credentials.secret_hash,
        user_id=str(user.id),
        username=user.username,
        role=user.role,
        token_version=user.token_version,
        absolute_ttl=timedelta(minutes=settings_obj.SESSION_ABSOLUTE_MINUTES),
        idle_ttl=timedelta(minutes=settings_obj.SESSION_IDLE_MINUTES),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await auth_session_repository_factory(db).save(auth_session)
    set_auth_cookies_func(response, credentials.cookie_value, csrf_token)

    logger.info(
        "로그인 성공: username=%s",
        user.username,
        extra={"client_ip": get_client_ip(request)},
    )
    return {
        "username": user.username,
        "role": user.role,
    }
