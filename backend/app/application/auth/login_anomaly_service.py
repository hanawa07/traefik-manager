from datetime import datetime, timedelta

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
) -> bool:
    if not client_ip:
        return False

    logs = await _load_recent_ip_logs(
        db=db,
        client_ip=client_ip,
        cutoff=now - block_window,
    )
    suspicious_logs = [
        log for log in logs
        if (log.detail or {}).get("event") == "login_suspicious"
    ]
    if not suspicious_logs:
        return False

    latest_suspicious_at = max(log.created_at for log in suspicious_logs)
    if any(
        (log.detail or {}).get("event") == "login_blocked_ip" and log.created_at >= latest_suspicious_at
        for log in logs
    ):
        return True

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
) -> bool:
    if not client_ip:
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
