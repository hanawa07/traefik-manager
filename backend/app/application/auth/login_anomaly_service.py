from datetime import datetime, timedelta
from ipaddress import ip_address, ip_network

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.infrastructure.persistence.models import AuditLogModel


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
    if not client_ip or not block_enabled or _is_trusted_client_ip(client_ip, trusted_networks):
        return False

    effective_lookup_window = block_window
    if escalation_enabled and escalation_window is not None and escalation_window > effective_lookup_window:
        effective_lookup_window = escalation_window

    logs = await _load_recent_ip_logs(
        db=db,
        client_ip=client_ip,
        cutoff=now - effective_lookup_window,
    )
    suspicious_logs = [
        log for log in logs
        if (log.detail or {}).get("event") == "login_suspicious"
    ]
    if not suspicious_logs:
        return False

    latest_suspicious_at = max(log.created_at for log in suspicious_logs)
    blocked_logs = sorted(
        [
            log
            for log in logs
            if (log.detail or {}).get("event") == "login_blocked_ip"
        ],
        key=lambda log: log.created_at,
    )
    latest_block_log = blocked_logs[-1] if blocked_logs else None
    if latest_block_log is not None:
        blocked_until = _get_blocked_until(latest_block_log, default_window=block_window)
        if blocked_until > now:
            return True
        if latest_suspicious_at <= latest_block_log.created_at:
            return False

    base_block_minutes = max(1, int(block_window.total_seconds() // 60))
    block_minutes = base_block_minutes
    repeat_count = 1
    if escalation_enabled:
        previous_block_count = len(blocked_logs)
        repeat_count = previous_block_count + 1
        block_minutes = base_block_minutes * (escalation_multiplier ** previous_block_count)
        if max_block_window is not None:
            max_block_minutes = max(1, int(max_block_window.total_seconds() // 60))
            block_minutes = min(block_minutes, max_block_minutes)

    blocked_until = now + timedelta(minutes=block_minutes)

    await audit_service.record(
        db=db,
        actor="system",
        action="update",
        resource_type="user",
        resource_id=client_ip[:36],
        resource_name=client_ip[:255],
        detail={
            "event": "login_blocked_ip",
            "client_ip": client_ip,
            "source_event": "login_suspicious",
            "source_created_at": latest_suspicious_at.isoformat(),
            "block_minutes": block_minutes,
            "blocked_until": blocked_until.isoformat(),
            "repeat_count": repeat_count,
            "escalated": block_minutes > base_block_minutes,
        },
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
    if not client_ip or _is_trusted_client_ip(client_ip, trusted_networks):
        return False

    logs = await _load_recent_ip_logs(
        db=db,
        client_ip=client_ip,
        cutoff=now - window,
    )

    failure_logs = []
    for log in logs:
        detail = log.detail or {}
        if detail.get("event") == "login_suspicious":
            return False
        if detail.get("event") in {"login_failure", "login_locked"}:
            failure_logs.append(log)

    usernames = {log.resource_name for log in failure_logs if log.resource_name}
    if len(failure_logs) < min_failures or len(usernames) < min_unique_usernames:
        return False

    await audit_service.record(
        db=db,
        actor="system",
        action="update",
        resource_type="user",
        resource_id=client_ip[:36],
        resource_name=client_ip[:255],
        detail={
            "event": "login_suspicious",
            "client_ip": client_ip,
            "failure_count": len(failure_logs),
            "unique_usernames": len(usernames),
            "usernames": sorted(usernames),
        },
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
    if not client_ip or failure_threshold <= 0 or _is_trusted_client_ip(client_ip, trusted_networks):
        return False

    logs = await _load_recent_ip_logs(
        db=db,
        client_ip=client_ip,
        cutoff=now - window,
    )

    failure_count = 0
    for log in logs:
        detail = log.detail or {}
        event = detail.get("event")
        if event in {"login_suspicious", "login_blocked_ip"}:
            return True
        if event in {"login_failure", "login_locked"}:
            failure_count += 1

    return failure_count >= failure_threshold


async def _load_recent_ip_logs(
    *,
    db: AsyncSession,
    client_ip: str,
    cutoff: datetime,
) -> list[AuditLogModel]:
    result = await db.execute(
        select(AuditLogModel).where(
            AuditLogModel.resource_type == "user",
            AuditLogModel.action == "update",
            AuditLogModel.created_at >= cutoff,
        )
    )
    logs = result.scalars().all()
    return [
        log
        for log in logs
        if (log.detail or {}).get("client_ip") == client_ip and log.created_at >= cutoff
    ]


def _is_trusted_client_ip(client_ip: str, trusted_networks: list[str] | None) -> bool:
    if not trusted_networks:
        return False
    try:
        address = ip_address(client_ip)
    except ValueError:
        return False

    for trusted_network in trusted_networks:
        try:
            if address in ip_network(trusted_network, strict=False):
                return True
        except ValueError:
            continue
    return False


def _get_blocked_until(log: AuditLogModel, *, default_window: timedelta) -> datetime:
    detail = log.detail or {}
    raw_blocked_until = detail.get("blocked_until")
    if isinstance(raw_blocked_until, str):
        try:
            parsed = datetime.fromisoformat(raw_blocked_until)
            if parsed.tzinfo is not None:
                return parsed
        except ValueError:
            pass

    raw_block_minutes = detail.get("block_minutes")
    try:
        block_minutes = int(raw_block_minutes)
        if block_minutes > 0:
            return log.created_at + timedelta(minutes=block_minutes)
    except (TypeError, ValueError):
        pass

    return log.created_at + default_window
