from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth import login_anomaly_service
from app.application.auth.auth_use_cases import AuthUseCases
from app.application.audit import audit_service
from app.core.config import settings
from app.core.session_security import issue_csrf_token, issue_session_credentials
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
from app.infrastructure.security import turnstile_verifier
from app.interfaces.api.dependencies import get_current_user, resolve_authenticated_user
from app.interfaces.api.v1.routers.auth_forward import verify_token_handler
from app.interfaces.api.v1.routers.auth_login import (
    get_login_protection_handler,
    login_handler,
)
from app.interfaces.api.v1.routers.auth_session_helpers import (
    clear_auth_cookies as _clear_auth_cookies,
    set_auth_cookies as _set_auth_cookies,
    to_session_response as _to_session_response,
)
from app.interfaces.api.v1.routers.auth_sessions import (
    get_current_session_handler,
    list_sessions_handler,
    logout_all_sessions_handler,
    logout_handler,
    revoke_session_handler,
)
from app.interfaces.api.v1.schemas.auth_schemas import (
    CurrentSessionResponse,
    LoginProtectionResponse,
    LoginResponse,
    SessionListResponse,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> AuthUseCases:
    return AuthUseCases(SQLiteUserRepository(db))


@router.post("/login", response_model=LoginResponse, summary="로그인")
async def login(
    request: Request,
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    use_cases: AuthUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
):
    return await login_handler(
        request=request,
        response=response,
        form=form,
        use_cases=use_cases,
        db=db,
        auth_session_repository_factory=SQLiteAuthSessionRepository,
        system_settings_repository_factory=SQLiteSystemSettingsRepository,
        issue_session_credentials_func=issue_session_credentials,
        issue_csrf_token_func=issue_csrf_token,
        set_auth_cookies_func=_set_auth_cookies,
        audit_service_module=audit_service,
        login_anomaly_service_module=login_anomaly_service,
        turnstile_verifier_module=turnstile_verifier,
        settings_obj=settings,
    )


@router.get("/login-protection", response_model=LoginProtectionResponse, summary="로그인 보호 공개 설정")
async def get_login_protection(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await get_login_protection_handler(
        request=request,
        db=db,
        system_settings_repository_factory=SQLiteSystemSettingsRepository,
        login_anomaly_service_module=login_anomaly_service,
        settings_obj=settings,
    )


@router.get("/me", response_model=CurrentSessionResponse, summary="현재 로그인 세션")
async def get_current_session(current_user: dict = Depends(get_current_user)):
    return await get_current_session_handler(current_user)


@router.get("/sessions", response_model=SessionListResponse, summary="내 세션 목록")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_sessions_handler(
        current_user=current_user,
        db=db,
        auth_session_repository_factory=SQLiteAuthSessionRepository,
        to_session_response_func=_to_session_response,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="로그아웃")
async def logout(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await logout_handler(
        response=response,
        current_user=current_user,
        db=db,
        auth_session_repository_factory=SQLiteAuthSessionRepository,
        clear_auth_cookies_func=_clear_auth_cookies,
    )


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT, summary="내 모든 세션 로그아웃")
async def logout_all_sessions(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await logout_all_sessions_handler(
        response=response,
        current_user=current_user,
        db=db,
        auth_session_repository_factory=SQLiteAuthSessionRepository,
        clear_auth_cookies_func=_clear_auth_cookies,
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="세션 종료")
async def revoke_session(
    session_id: str,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await revoke_session_handler(
        session_id=session_id,
        response=response,
        current_user=current_user,
        db=db,
        auth_session_repository_factory=SQLiteAuthSessionRepository,
        clear_auth_cookies_func=_clear_auth_cookies,
    )


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
    return await verify_token_handler(
        request=request,
        db=db,
        service_model=ServiceModel,
        resolve_authenticated_user_func=resolve_authenticated_user,
    )
