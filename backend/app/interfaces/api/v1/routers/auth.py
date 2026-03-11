import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_use_cases import AuthUseCases
from app.core.config import settings
from app.core.logging_config import get_client_ip
from app.core.session_security import issue_csrf_token, issue_session_credentials
from app.domain.auth.entities.auth_session import AuthSession
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import ServiceModel
from app.infrastructure.persistence.repositories.sqlite_auth_session_repository import (
    SQLiteAuthSessionRepository,
)
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)
from app.interfaces.api.dependencies import get_current_user, resolve_authenticated_user
from app.interfaces.api.v1.schemas.auth_schemas import CurrentSessionResponse, LoginResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def get_use_cases(db: AsyncSession = Depends(get_db)) -> AuthUseCases:
    return AuthUseCases(SQLiteUserRepository(db))


def _set_auth_cookies(response: Response, session_cookie_value: str, csrf_token: str) -> None:
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


def _clear_auth_cookies(response: Response) -> None:
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


@router.post("/login", response_model=LoginResponse, summary="로그인")
async def login(
    request: Request,
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    use_cases: AuthUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
):
    user = await use_cases.authenticate_user(form.username, form.password)
    if not user:
        logger.warning(
            "로그인 실패: username=%s",
            form.username,
            extra={"client_ip": get_client_ip(request)},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
        )

    credentials = issue_session_credentials()
    csrf_token = issue_csrf_token()
    auth_session = AuthSession.issue(
        session_id=credentials.session_id,
        session_secret_hash=credentials.secret_hash,
        user_id=str(user.id),
        username=user.username,
        role=user.role,
        token_version=user.token_version,
        absolute_ttl=timedelta(minutes=settings.SESSION_ABSOLUTE_MINUTES),
        idle_ttl=timedelta(minutes=settings.SESSION_IDLE_MINUTES),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await SQLiteAuthSessionRepository(db).save(auth_session)
    _set_auth_cookies(response, credentials.cookie_value, csrf_token)

    logger.info(
        "로그인 성공: username=%s",
        user.username,
        extra={"client_ip": get_client_ip(request)},
    )
    return {
        "username": user.username,
        "role": user.role,
    }


@router.get("/me", response_model=CurrentSessionResponse, summary="현재 로그인 세션")
async def get_current_session(current_user: dict = Depends(get_current_user)):
    auth_session = current_user["session"]
    return CurrentSessionResponse(
        username=current_user["username"],
        role=current_user["role"],
        session_id=auth_session.id,
        issued_at=auth_session.issued_at,
        expires_at=auth_session.expires_at,
        idle_expires_at=auth_session.idle_expires_at,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="로그아웃")
async def logout(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auth_session = current_user["session"]
    auth_session.revoke("user_logout")
    await SQLiteAuthSessionRepository(db).save(auth_session)
    _clear_auth_cookies(response)
    logger.info("로그아웃: username=%s", current_user["username"])


@router.get(
    "/verify",
    status_code=200,
    summary="Traefik forwardAuth 토큰 검증",
    include_in_schema=False,
)
async def verify_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Traefik forwardAuth 미들웨어가 호출하는 엔드포인트.
    1. 서비스 전용 API Key 검증 (우선)
    2. 관리자 세션 쿠키 검증
    """
    auth_header = request.headers.get("Authorization", "")
    forwarded_host = request.headers.get("X-Forwarded-Host")

    if auth_header.startswith("Bearer ") and forwarded_host:
        token = auth_header[7:]
        result = await db.execute(
            select(ServiceModel).where(ServiceModel.domain == forwarded_host)
        )
        service = result.scalar_one_or_none()

        if service and service.auth_mode == "token" and service.api_key == token:
            return Response(
                status_code=200,
                headers={
                    "X-Auth-User": f"api-key-{service.name}",
                    "X-Auth-Role": "api",
                },
            )

    try:
        user, _auth_session = await resolve_authenticated_user(request=request, db=db)
        return Response(
            status_code=200,
            headers={
                "X-Auth-User": user.username,
                "X-Auth-Role": user.role,
            },
        )
    except HTTPException:
        return Response(status_code=401)
