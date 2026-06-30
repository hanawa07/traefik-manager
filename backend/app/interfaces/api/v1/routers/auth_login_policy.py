import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_client_ip
from app.interfaces.api.v1.routers.auth_settings_helpers import (
    get_bool_system_setting,
    get_int_system_setting,
    is_turnstile_required,
    split_multivalue_setting,
)
from app.interfaces.api.v1.schemas.auth_schemas import LoginProtectionResponse
from app.interfaces.api.v1.schemas.settings_schemas import normalize_trusted_networks

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LoginProtectionContext:
    current: datetime
    client_ip: str
    system_settings_repo: Any
    trusted_networks: list[str]
    suspicious_block_enabled: bool
    suspicious_block_escalation_enabled: bool
    suspicious_block_escalation_window_minutes: int
    suspicious_block_escalation_multiplier: int
    suspicious_block_max_minutes: int


async def build_login_protection_context(
    *,
    request: Request,
    db: AsyncSession,
    system_settings_repository_factory: Callable[[AsyncSession], Any],
    settings_obj: Any,
) -> LoginProtectionContext:
    current = datetime.now(timezone.utc)
    client_ip = get_client_ip(request)
    system_settings_repo = system_settings_repository_factory(db)
    trusted_networks = normalize_trusted_networks(
        split_multivalue_setting(await system_settings_repo.get("login_suspicious_trusted_networks"))
    )
    return LoginProtectionContext(
        current=current,
        client_ip=client_ip,
        system_settings_repo=system_settings_repo,
        trusted_networks=trusted_networks,
        suspicious_block_enabled=await get_bool_system_setting(
            system_settings_repo,
            "login_suspicious_block_enabled",
            default=True,
        ),
        suspicious_block_escalation_enabled=await get_bool_system_setting(
            system_settings_repo,
            "login_suspicious_block_escalation_enabled",
            default=settings_obj.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_ENABLED,
        ),
        suspicious_block_escalation_window_minutes=await get_int_system_setting(
            system_settings_repo,
            "login_suspicious_block_escalation_window_minutes",
            default=settings_obj.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_WINDOW_MINUTES,
        ),
        suspicious_block_escalation_multiplier=await get_int_system_setting(
            system_settings_repo,
            "login_suspicious_block_escalation_multiplier",
            default=settings_obj.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_MULTIPLIER,
        ),
        suspicious_block_max_minutes=await get_int_system_setting(
            system_settings_repo,
            "login_suspicious_block_max_minutes",
            default=settings_obj.LOGIN_SUSPICIOUS_BLOCK_MAX_MINUTES,
        ),
    )


async def enforce_login_suspicious_ip_block(
    *,
    context: LoginProtectionContext,
    db: AsyncSession,
    login_anomaly_service_module,
    settings_obj: Any,
) -> None:
    if await login_anomaly_service_module.enforce_suspicious_ip_block_if_needed(
        db=db,
        client_ip=context.client_ip,
        now=context.current,
        block_window=timedelta(minutes=settings_obj.LOGIN_SUSPICIOUS_BLOCK_MINUTES),
        block_enabled=context.suspicious_block_enabled,
        trusted_networks=context.trusted_networks,
        escalation_enabled=context.suspicious_block_escalation_enabled,
        escalation_window=timedelta(minutes=context.suspicious_block_escalation_window_minutes),
        escalation_multiplier=context.suspicious_block_escalation_multiplier,
        max_block_window=timedelta(minutes=context.suspicious_block_max_minutes),
    ):
        logger.warning(
            "로그인 차단: ip=%s reason=%s",
            context.client_ip,
            "suspicious_ip",
            extra={"client_ip": context.client_ip, "failure_reason": "suspicious_ip"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
        )


async def verify_turnstile_if_required(
    *,
    request: Request,
    context: LoginProtectionContext,
    db: AsyncSession,
    login_anomaly_service_module,
    turnstile_verifier_module,
    settings_obj: Any,
) -> None:
    _, turnstile_required = await is_turnstile_required(
        repo=context.system_settings_repo,
        db=db,
        client_ip=context.client_ip,
        now=context.current,
        trusted_networks=context.trusted_networks,
        settings_obj=settings_obj,
        login_anomaly_service_module=login_anomaly_service_module,
    )
    if not turnstile_required:
        return

    turnstile_site_key = (await context.system_settings_repo.get("login_turnstile_site_key")) or ""
    turnstile_secret_key = (await context.system_settings_repo.get("login_turnstile_secret_key")) or ""
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
        remote_ip=context.client_ip,
    )
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="추가 로그인 검증에 실패했습니다",
        )


async def build_login_protection_response(
    *,
    request: Request,
    db: AsyncSession,
    system_settings_repository_factory: Callable[[AsyncSession], Any],
    login_anomaly_service_module,
    settings_obj: Any,
) -> LoginProtectionResponse:
    repo = system_settings_repository_factory(db)
    trusted_networks = normalize_trusted_networks(
        split_multivalue_setting(await repo.get("login_suspicious_trusted_networks"))
    )
    turnstile_mode, turnstile_required = await is_turnstile_required(
        repo=repo,
        db=db,
        client_ip=get_client_ip(request),
        now=datetime.now(timezone.utc),
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
