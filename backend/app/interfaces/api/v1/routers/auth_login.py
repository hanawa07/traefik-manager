from typing import Any, Callable

from fastapi import Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_use_cases import AuthUseCases
from app.interfaces.api.v1.routers.auth_login_failure import reject_failed_login
from app.interfaces.api.v1.routers.auth_login_policy import (
    build_login_protection_context,
    build_login_protection_response,
    enforce_login_suspicious_ip_block,
    verify_turnstile_if_required,
)
from app.interfaces.api.v1.routers.auth_login_session import issue_successful_login_session
from app.interfaces.api.v1.schemas.auth_schemas import LoginProtectionResponse


async def login_handler(
    *,
    request: Request,
    response: Response,
    form,
    use_cases: AuthUseCases,
    db: AsyncSession,
    auth_session_repository_factory: Callable[[AsyncSession], Any],
    system_settings_repository_factory: Callable[[AsyncSession], Any],
    issue_session_credentials_func: Callable[[], Any],
    issue_csrf_token_func: Callable[[], str],
    set_auth_cookies_func: Callable[[Response, str, str], None],
    audit_service_module,
    login_anomaly_service_module,
    turnstile_verifier_module,
    settings_obj: Any,
):
    protection_context = await build_login_protection_context(
        request=request,
        db=db,
        system_settings_repository_factory=system_settings_repository_factory,
        settings_obj=settings_obj,
    )
    await enforce_login_suspicious_ip_block(
        context=protection_context,
        db=db,
        login_anomaly_service_module=login_anomaly_service_module,
        settings_obj=settings_obj,
    )
    await verify_turnstile_if_required(
        request=request,
        context=protection_context,
        db=db,
        login_anomaly_service_module=login_anomaly_service_module,
        turnstile_verifier_module=turnstile_verifier_module,
        settings_obj=settings_obj,
    )

    auth_result = await use_cases.authenticate_user(form.username, form.password)
    if not auth_result.authenticated_user:
        await reject_failed_login(
            form=form,
            auth_result=auth_result,
            db=db,
            current=protection_context.current,
            client_ip=protection_context.client_ip,
            trusted_networks=protection_context.trusted_networks,
            audit_service_module=audit_service_module,
            login_anomaly_service_module=login_anomaly_service_module,
            settings_obj=settings_obj,
        )

    return await issue_successful_login_session(
        request=request,
        response=response,
        user=auth_result.authenticated_user,
        db=db,
        auth_session_repository_factory=auth_session_repository_factory,
        issue_session_credentials_func=issue_session_credentials_func,
        issue_csrf_token_func=issue_csrf_token_func,
        set_auth_cookies_func=set_auth_cookies_func,
        settings_obj=settings_obj,
    )


async def get_login_protection_handler(
    *,
    request: Request,
    db: AsyncSession,
    system_settings_repository_factory: Callable[[AsyncSession], Any],
    login_anomaly_service_module,
    settings_obj: Any,
) -> LoginProtectionResponse:
    return await build_login_protection_response(
        request=request,
        db=db,
        system_settings_repository_factory=system_settings_repository_factory,
        login_anomaly_service_module=login_anomaly_service_module,
        settings_obj=settings_obj,
    )
