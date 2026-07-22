from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditLogModel


async def record_github_api_rate_limit_audit(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    rate_limit_event: dict[str, int | str | None],
) -> None:
    kind = rate_limit_event.get("kind")
    if kind not in {"primary", "secondary"}:
        return
    event = f"github_api_{kind}_rate_limit"
    label = "기본 요청 한도" if kind == "primary" else "보조 요청 제한"
    count_result = await db.execute(
        select(func.count(AuditLogModel.id)).where(
            AuditLogModel.detail["event"].as_string() == event
        )
    )
    await audit_service.record(
        db=db,
        actor=actor,
        action="alert",
        resource_type="settings",
        resource_id=event,
        resource_name=f"GitHub API {label}",
        detail={
            "event": event,
            "occurred_at": rate_limit_event.get("occurred_at"),
            "occurrence_count": count_result.scalar_one() + 1,
            "retry_at": rate_limit_event.get("retry_at"),
        },
        notify=False,
    )
