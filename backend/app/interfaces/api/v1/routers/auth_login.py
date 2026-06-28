import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from fastapi import HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_use_cases import AuthUseCases
from app.core.logging_config import get_client_ip
from app.domain.auth.entities.auth_session import AuthSession
from app.interfaces.api.v1.routers.auth_settings_helpers import (
    get_bool_system_setting,
    get_int_system_setting,
    is_turnstile_required,
    split_multivalue_setting,
)
from app.interfaces.api.v1.schemas.auth_schemas import LoginProtectionResponse
from app.interfaces.api.v1.schemas.settings_schemas import normalize_trusted_networks

logger = logging.getLogger(__name__)


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
    current = datetime.now(timezone.utc)
    client_ip = get_client_ip(request)
    system_settings_repo = system_settings_repository_factory(db)
    suspicious_block_enabled = await get_bool_system_setting(
        system_settings_repo,
        "login_suspicious_block_enabled",
        default=True,
    )
    suspicious_block_escalation_enabled = await get_bool_system_setting(
        system_settings_repo,
        "login_suspicious_block_escalation_enabled",
        default=settings_obj.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_ENABLED,
    )
    suspicious_block_escalation_window_minutes = await get_int_system_setting(
        system_settings_repo,
        "login_suspicious_block_escalation_window_minutes",
        default=settings_obj.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_WINDOW_MINUTES,
    )
    suspicious_block_escalation_multiplier = await get_int_system_setting(
        system_settings_repo,
        "login_suspicious_block_escalation_multiplier",
        default=settings_obj.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_MULTIPLIER,
    )
    suspicious_block_max_minutes = await get_int_system_setting(
        system_settings_repo,
        "login_suspicious_block_max_minutes",
        default=settings_obj.LOGIN_SUSPICIOUS_BLOCK_MAX_MINUTES,
    )
    trusted_networks = normalize_trusted_networks(
        split_multivalue_setting(await system_settings_repo.get("login_suspicious_trusted_networks"))
    )
    if await login_anomaly_service_module.enforce_suspicious_ip_block_if_needed(
        db=db,
        client_ip=client_ip,
        now=current,
        block_window=timedelta(minutes=settings_obj.LOGIN_SUSPICIOUS_BLOCK_MINUTES),
        block_enabled=suspicious_block_enabled,
        trusted_networks=trusted_networks,
        escalation_enabled=suspicious_block_escalation_enabled,
        escalation_window=timedelta(minutes=suspicious_block_escalation_window_minutes),
        escalation_multiplier=suspicious_block_escalation_multiplier,
        max_block_window=timedelta(minutes=suspicious_block_max_minutes),
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

    _, turnstile_required = await is_turnstile_required(
        repo=system_settings_repo,
        db=db,
        client_ip=client_ip,
        now=current,
        trusted_networks=trusted_networks,
        settings_obj=settings_obj,
        login_anomaly_service_module=login_anomaly_service_module,
    )
    turnstile_site_key = (await system_settings_repo.get("login_turnstile_site_key")) or ""
    turnstile_secret_key = (await system_settings_repo.get("login_turnstile_secret_key")) or ""
    if turnstile_required:
        submitted_form = await request.form()
        turnstile_token = str(submitted_form.get("cf-turnstile-response") or "").strip()
        if not turnstile_token or not turnstile_site_key or not turnstile_secret_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="추가 로그인 검증에 실패했습니다",
            )
        verified = await turnstile_verifier_module.verify_token(
            token=turnstile_token,
            secret_key=turnstile_secret_key,
            remote_ip=client_ip,
        )
        if not verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="추가 로그인 검증에 실패했습니다",
            )

    auth_result = await use_cases.authenticate_user(form.username, form.password)
    if not auth_result.authenticated_user:
        event = "login_locked" if auth_result.failure_reason == "locked" else "login_failure"
        await audit_service_module.record(
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
        await login_anomaly_service_module.record_suspicious_login_activity_if_needed(
            db=db,
            client_ip=client_ip,
            now=current,
            window=timedelta(minutes=settings_obj.LOGIN_SUSPICIOUS_WINDOW_MINUTES),
            min_failures=settings_obj.LOGIN_SUSPICIOUS_FAILURE_COUNT,
            min_unique_usernames=settings_obj.LOGIN_SUSPICIOUS_USERNAME_COUNT,
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


async def get_login_protection_handler(
    *,
    request: Request,
    db: AsyncSession,
    system_settings_repository_factory: Callable[[AsyncSession], Any],
    login_anomaly_service_module,
    settings_obj: Any,
) -> LoginProtectionResponse:
    repo = system_settings_repository_factory(db)
    current = datetime.now(timezone.utc)
    trusted_networks = normalize_trusted_networks(
        split_multivalue_setting(await repo.get("login_suspicious_trusted_networks"))
    )
    turnstile_mode, turnstile_required = await is_turnstile_required(
        repo=repo,
        db=db,
        client_ip=get_client_ip(request),
        now=current,
        trusted_networks=trusted_networks,
        settings_obj=settings_obj,
        login_anomaly_service_module=login_anomaly_service_module,
    )
    return LoginProtectionResponse(
        turnstile_mode=turnstile_mode,
        turnstile_enabled=turnstile_mode != "off",
        turnstile_required=turnstile_required,
        turnstile_site_key=await repo.get("login_turnstile_site_key"),
    )
