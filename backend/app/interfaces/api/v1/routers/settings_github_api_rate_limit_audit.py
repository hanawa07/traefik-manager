from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.interfaces.api.v1.routers.settings_smoke_monitoring_values import (
    read_github_api_rate_limit_alert_values,
)


async def record_github_api_rate_limit_audit(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    rate_limit_event: dict[str, int | str | None],
    settings_repository_factory: Any = SQLiteSystemSettingsRepository,
    now: datetime | None = None,
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
    alert_settings = await read_github_api_rate_limit_alert_values(
        settings_repository_factory(db)
    )
    notify = False
    window_count = None
    threshold = (
        alert_settings["monitoring_github_primary_limit_alert_threshold"]
        if kind == "primary"
        else alert_settings["monitoring_github_secondary_limit_alert_threshold"]
    )
    if alert_settings["monitoring_github_rate_limit_alert_enabled"]:
        current = now or datetime.now(timezone.utc)
        if current.tzinfo is not None:
            current = current.astimezone(timezone.utc).replace(tzinfo=None)
        cutoff = current - timedelta(
            hours=alert_settings["monitoring_github_rate_limit_alert_window_hours"]
        )
        window_result = await db.execute(
            select(func.count(AuditLogModel.id)).where(
                AuditLogModel.detail["event"].as_string() == event,
                AuditLogModel.created_at >= cutoff,
            )
        )
        window_count = window_result.scalar_one() + 1
        notify = window_count == threshold
    detail = {
        "event": event,
        "occurred_at": rate_limit_event.get("occurred_at"),
        "occurrence_count": count_result.scalar_one() + 1,
        "retry_at": rate_limit_event.get("retry_at"),
    }
    if window_count is not None:
        detail.update(
            {
                "alert_triggered": notify,
                "alert_window_hours": alert_settings[
                    "monitoring_github_rate_limit_alert_window_hours"
                ],
                "alert_threshold": threshold,
                "window_occurrence_count": window_count,
            }
        )
    await audit_service.record(
        db=db,
        actor=actor,
        action="alert",
        resource_type="settings",
        resource_id=event,
        resource_name=f"GitHub API {label}",
        detail=detail,
        notify=notify,
    )
