from datetime import timedelta
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_log_helpers import normalize_utc


async def load_delayed_automatic_retries(
    db: AsyncSession,
    conditions: Sequence[ColumnElement[bool]],
    warning_minutes: int,
) -> list[AuditLogModel]:
    result = await db.execute(
        select(AuditLogModel).where(
            *conditions,
            AuditLogModel.action == "alert",
            AuditLogModel.detail["trigger"].as_string() == "automatic_retry",
        )
    )
    candidates = list(result.scalars().all())
    parent_ids = {
        parent_id
        for log in candidates
        if isinstance(parent_id := (log.detail or {}).get("retry_of_audit_id"), str)
    }
    if not parent_ids:
        return []

    parent_result = await db.execute(select(AuditLogModel).where(AuditLogModel.id.in_(parent_ids)))
    parents_by_id = {str(log.id): log for log in parent_result.scalars().all()}
    delayed = filter_delayed_automatic_retries(candidates, parents_by_id, warning_minutes)
    return sorted(
        delayed,
        key=lambda log: (normalize_utc(log.created_at), str(log.id)),
        reverse=True,
    )


def filter_delayed_automatic_retries(
    candidates: Sequence[AuditLogModel],
    parents_by_id: dict[str, AuditLogModel],
    warning_minutes: int,
) -> list[AuditLogModel]:
    threshold = timedelta(minutes=warning_minutes)
    delayed: list[AuditLogModel] = []
    for log in candidates:
        parent_id = (log.detail or {}).get("retry_of_audit_id")
        parent = parents_by_id.get(parent_id) if isinstance(parent_id, str) else None
        if parent and normalize_utc(log.created_at) - normalize_utc(parent.created_at) > threshold:
            delayed.append(log)
    return delayed
