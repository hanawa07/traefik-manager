from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


def turnstile_risk_failure_threshold(settings_obj: Any) -> int:
    return max(2, settings_obj.LOGIN_MAX_FAILED_ATTEMPTS - 2)


async def get_bool_system_setting(
    repo,
    key: str,
    *,
    default: bool,
) -> bool:
    value = await repo.get(key)
    if value is None:
        return default
    return value.strip().lower() == "true"


async def get_int_system_setting(
    repo,
    key: str,
    *,
    default: int,
) -> int:
    value = await repo.get(key)
    if value is None:
        return default
    try:
        return int(value.strip())
    except ValueError:
        return default


async def get_turnstile_mode(repo) -> str:
    stored_mode = ((await repo.get("login_turnstile_mode")) or "").strip().lower()
    if stored_mode in {"off", "always", "risk_based"}:
        return stored_mode

    legacy_enabled = await get_bool_system_setting(repo, "login_turnstile_enabled", default=False)
    return "always" if legacy_enabled else "off"


def split_multivalue_setting(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]


async def is_turnstile_required(
    *,
    repo,
    db: AsyncSession,
    client_ip: str | None,
    now: datetime,
    trusted_networks: list[str],
    settings_obj: Any,
    login_anomaly_service_module,
) -> tuple[str, bool]:
    turnstile_mode = await get_turnstile_mode(repo)
    if turnstile_mode == "off":
        return turnstile_mode, False
    if turnstile_mode == "always":
        return turnstile_mode, True

    return turnstile_mode, await login_anomaly_service_module.should_require_turnstile_for_ip(
        db=db,
        client_ip=client_ip,
        now=now,
        window=timedelta(minutes=settings_obj.LOGIN_FAILURE_WINDOW_MINUTES),
        failure_threshold=turnstile_risk_failure_threshold(settings_obj),
        trusted_networks=trusted_networks,
    )
