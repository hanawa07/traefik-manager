import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_use_cases import AuthUseCases
from app.application.audit import audit_service
from app.application.auth import login_anomaly_service
from app.core.config import settings
from app.core.logging_config import get_client_ip
from app.core.session_security import issue_csrf_token, issue_session_credentials
from app.domain.auth.entities.auth_session import AuthSession
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import ServiceModel
from app.infrastructure.persistence.repositories.sqlite_auth_session_repository import (
    SQLiteAuthSessionRepository,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)
from app.interfaces.api.v1.schemas.settings_schemas import normalize_trusted_networks
from app.interfaces.api.dependencies import get_current_user, resolve_authenticated_user
from app.interfaces.api.v1.schemas.auth_schemas import (
    CurrentSessionResponse,
    LoginResponse,
    SessionInfoResponse,
    SessionListResponse,
)

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


def _to_session_response(session: AuthSession, current_session_id: str) -> SessionInfoResponse:
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


@router.post("/login", response_model=LoginResponse, summary="로그인")
async def login(
    request: Request,
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    use_cases: AuthUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
):
    current = datetime.now(timezone.utc)
    client_ip = get_client_ip(request)
    system_settings_repo = SQLiteSystemSettingsRepository(db)
    suspicious_block_enabled = await _get_bool_system_setting(
        system_settings_repo,
        "login_suspicious_block_enabled",
        default=True,
    )
    trusted_networks = normalize_trusted_networks(
        _split_multivalue_setting(await system_settings_repo.get("login_suspicious_trusted_networks"))
    )
    if await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=db,
        client_ip=client_ip,
        now=current,
        block_window=timedelta(minutes=settings.LOGIN_SUSPICIOUS_BLOCK_MINUTES),
        block_enabled=suspicious_block_enabled,
        trusted_networks=trusted_networks,
    ):
        logger.warning(
            "로그인 차단: ip=%s reason=%s",
            client_ip,
            "suspicious_ip",
            extra={"client_ip": client_ip, "failure_reason": "suspicious_ip"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
        )

    auth_result = await use_cases.authenticate_user(form.username, form.password)
    if not auth_result.authenticated_user:
        event = "login_locked" if auth_result.failure_reason == "locked" else "login_failure"
        await audit_service.record(
            db=db,
            actor=form.username.strip() or "anonymous",
            action="update",
            resource_type="user",
            resource_id=(
                str(auth_result.subject_user.id)
                if auth_result.subject_user
                else (form.username.strip() or "unknown")[:36]
            ),
            resource_name=(
                auth_result.subject_user.username
                if auth_result.subject_user
                else (form.username.strip() or "unknown")
            ),
            detail={
                "event": event,
                "client_ip": client_ip,
                "locked_until": (
                    auth_result.locked_until.isoformat()
                    if auth_result.locked_until is not None
                    else None
                ),
            },
        )
        await login_anomaly_service.record_suspicious_login_activity_if_needed(
            db=db,
            client_ip=client_ip,
            now=current,
            window=timedelta(minutes=settings.LOGIN_SUSPICIOUS_WINDOW_MINUTES),
            min_failures=settings.LOGIN_SUSPICIOUS_FAILURE_COUNT,
            min_unique_usernames=settings.LOGIN_SUSPICIOUS_USERNAME_COUNT,
            trusted_networks=trusted_networks,
        )
        logger.warning(
            "로그인 실패: username=%s reason=%s",
            form.username,
            auth_result.failure_reason,
            extra={
                "client_ip": client_ip,
                "failure_reason": auth_result.failure_reason,
                "locked_until": (
                    auth_result.locked_until.isoformat()
                    if auth_result.locked_until is not None
                    else None
                ),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
        )
    user = auth_result.authenticated_user

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


async def _get_bool_system_setting(
    repo: SQLiteSystemSettingsRepository,
    key: str,
    *,
    default: bool,
) -> bool:
    value = await repo.get(key)
    if value is None:
        return default
    return value.strip().lower() == "true"


def _split_multivalue_setting(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]


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


@router.get("/sessions", response_model=SessionListResponse, summary="내 세션 목록")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repository = SQLiteAuthSessionRepository(db)
    sessions = await repository.find_active_by_user_id(
        current_user["id"],
        datetime.now(timezone.utc),
    )
    return SessionListResponse(
        sessions=[_to_session_response(session, current_user["session_id"]) for session in sessions]
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


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT, summary="내 모든 세션 로그아웃")
async def logout_all_sessions(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repository = SQLiteAuthSessionRepository(db)
    revoked_at = datetime.now(timezone.utc)
    sessions = await repository.find_active_by_user_id(current_user["id"], revoked_at)
    for session in sessions:
        session.revoke("user_logout_all", revoked_at=revoked_at)
        await repository.save(session)
    _clear_auth_cookies(response)
    logger.info("전체 로그아웃: username=%s count=%d", current_user["username"], len(sessions))


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="세션 종료")
async def revoke_session(
    session_id: str,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repository = SQLiteAuthSessionRepository(db)
    auth_session = await repository.find_by_id(session_id)
    if not auth_session or auth_session.user_id != current_user["id"] or auth_session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="세션을 찾을 수 없습니다")

    auth_session.revoke("user_logout_session")
    await repository.save(auth_session)
    if auth_session.id == current_user["session_id"]:
        _clear_auth_cookies(response)
    logger.info("세션 종료: username=%s session_id=%s", current_user["username"], session_id)


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
