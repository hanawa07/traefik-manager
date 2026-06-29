from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.application.auth.login_anomaly_logs import load_recent_ip_logs, normalize_utc
from app.application.auth.login_anomaly_policy import (
    build_suspicious_login_detail,
    decide_suspicious_ip_block,
    should_require_turnstile_from_logs,
)
from app.application.auth.login_anomaly_networks import is_trusted_client_ip


async def enforce_suspicious_ip_block_if_needed(
    *,
    db: AsyncSession,
    client_ip: str | None,
    now: datetime,
    block_window: timedelta,
    block_enabled: bool = True,
    trusted_networks: list[str] | None = None,
    escalation_enabled: bool = False,
    escalation_window: timedelta | None = None,
    escalation_multiplier: int = 2,
    max_block_window: timedelta | None = None,
) -> bool:
    now = normalize_utc(now)

    if not client_ip or not block_enabled or is_trusted_client_ip(client_ip, trusted_networks):
        return False

    effective_lookup_window = block_window
    if escalation_enabled and escalation_window is not None and escalation_window > effective_lookup_window:
        effective_lookup_window = escalation_window

    logs = await load_recent_ip_logs(
        db=db,
        client_ip=client_ip,
        cutoff=now - effective_lookup_window,
    )
    decision = decide_suspicious_ip_block(
        logs=logs,
        client_ip=client_ip,
        now=now,
        block_window=block_window,
        escalation_enabled=escalation_enabled,
        escalation_multiplier=escalation_multiplier,
        max_block_window=max_block_window,
    )
    if not decision.blocked:
        return False
    if decision.detail is None:
        return True

    await audit_service.record(
        db=db,
        actor="system",
        action="update",
        resource_type="user",
        resource_id=client_ip[:36],
        resource_name=client_ip[:255],
        detail=decision.detail,
    )
    return True


async def record_suspicious_login_activity_if_needed(
    *,
    db: AsyncSession,
    client_ip: str | None,
    now: datetime,
    window: timedelta,
    min_failures: int,
    min_unique_usernames: int,
    trusted_networks: list[str] | None = None,
) -> bool:
    now = normalize_utc(now)

    if not client_ip or is_trusted_client_ip(client_ip, trusted_networks):
        return False

    logs = await load_recent_ip_logs(
        db=db,
        client_ip=client_ip,
        cutoff=now - window,
    )
    detail = build_suspicious_login_detail(
        logs=logs,
        client_ip=client_ip,
        min_failures=min_failures,
        min_unique_usernames=min_unique_usernames,
    )
    if detail is None:
        return False

    await audit_service.record(
        db=db,
        actor="system",
        action="update",
        resource_type="user",
        resource_id=client_ip[:36],
        resource_name=client_ip[:255],
        detail=detail,
    )
    return True


async def should_require_turnstile_for_ip(
    *,
    db: AsyncSession,
    client_ip: str | None,
    now: datetime,
    window: timedelta,
    failure_threshold: int,
    trusted_networks: list[str] | None = None,
) -> bool:
    now = normalize_utc(now)

    if not client_ip or failure_threshold <= 0 or is_trusted_client_ip(client_ip, trusted_networks):
        return False

    logs = await load_recent_ip_logs(
        db=db,
        client_ip=client_ip,
        cutoff=now - window,
    )

    return should_require_turnstile_from_logs(
        logs=logs,
        failure_threshold=failure_threshold,
    )
