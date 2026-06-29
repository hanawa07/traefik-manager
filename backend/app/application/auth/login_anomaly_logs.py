from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditLogModel


async def load_recent_ip_logs(
    *,
    db: AsyncSession,
    client_ip: str,
    cutoff: datetime,
) -> list[AuditLogModel]:
    normalized_cutoff = normalize_utc(cutoff)
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
        if (log.detail or {}).get("client_ip") == client_ip
        and get_log_created_at(log) >= normalized_cutoff
    ]


def get_log_created_at(log: AuditLogModel) -> datetime:
    return normalize_utc(log.created_at)


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
