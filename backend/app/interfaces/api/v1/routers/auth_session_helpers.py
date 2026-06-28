from fastapi import Response

from app.core.config import settings
from app.domain.auth.entities.auth_session import AuthSession
from app.interfaces.api.v1.schemas.auth_schemas import SessionInfoResponse


def set_auth_cookies(response: Response, session_cookie_value: str, csrf_token: str) -> None:
    max_age = settings.SESSION_ABSOLUTE_MINUTES * 60
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_cookie_value,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path="/",
        max_age=max_age,
    )
    response.set_cookie(
        key=settings.SESSION_CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path="/",
        max_age=max_age,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.SESSION_CSRF_COOKIE_NAME,
        path="/",
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )


def to_session_response(session: AuthSession, current_session_id: str) -> SessionInfoResponse:
    return SessionInfoResponse(
        session_id=session.id,
        issued_at=session.issued_at,
        last_seen_at=session.last_seen_at,
        expires_at=session.expires_at,
        idle_expires_at=session.idle_expires_at,
        ip_address=session.ip_address,
        user_agent=session.user_agent,
        is_current=session.id == current_session_id,
    )
