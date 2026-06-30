from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_use_cases import AuthUseCases
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.v1.routers.auth_login import (
    get_login_protection_handler,
    login_handler,
)
from app.interfaces.api.v1.schemas.auth_schemas import (
    LoginProtectionResponse,
    LoginResponse,
)


@dataclass(frozen=True)
class AuthLoginEndpoints:
    login: Callable[..., Any]
    get_login_protection: Callable[..., Any]


def register_auth_login_routes(
    router: APIRouter,
    *,
    get_use_cases: Callable[..., AuthUseCases],
    auth_session_repository_factory_provider: Callable[[], Callable[[AsyncSession], Any]],
    system_settings_repository_factory_provider: Callable[[], Callable[[AsyncSession], Any]],
    issue_session_credentials_provider: Callable[[], Callable[[], Any]],
    issue_csrf_token_provider: Callable[[], Callable[[], str]],
    set_auth_cookies_func: Callable[[Response, str, str], None],
    audit_service_provider: Callable[[], Any],
    login_anomaly_service_provider: Callable[[], Any],
    turnstile_verifier_provider: Callable[[], Any],
    settings_provider: Callable[[], Any],
) -> AuthLoginEndpoints:
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
            auth_session_repository_factory=auth_session_repository_factory_provider(),
            system_settings_repository_factory=system_settings_repository_factory_provider(),
            issue_session_credentials_func=issue_session_credentials_provider(),
            issue_csrf_token_func=issue_csrf_token_provider(),
            set_auth_cookies_func=set_auth_cookies_func,
            audit_service_module=audit_service_provider(),
            login_anomaly_service_module=login_anomaly_service_provider(),
            turnstile_verifier_module=turnstile_verifier_provider(),
            settings_obj=settings_provider(),
        )

    @router.get(
        "/login-protection",
        response_model=LoginProtectionResponse,
        summary="로그인 보호 공개 설정",
    )
    async def get_login_protection(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ):
        return await get_login_protection_handler(
            request=request,
            db=db,
            system_settings_repository_factory=system_settings_repository_factory_provider(),
            login_anomaly_service_module=login_anomaly_service_provider(),
            settings_obj=settings_provider(),
        )

    return AuthLoginEndpoints(
        login=login,
        get_login_protection=get_login_protection,
    )
