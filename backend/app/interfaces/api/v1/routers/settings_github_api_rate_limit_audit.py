from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


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
            "occurrence_count": rate_limit_event.get("occurrence_count"),
            "retry_at": rate_limit_event.get("retry_at"),
        },
        notify=False,
    )
