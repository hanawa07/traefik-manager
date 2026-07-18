import json
from datetime import datetime, timezone
from typing import Any, Callable

from app.application.audit import audit_service
from app.infrastructure.manager_deployment_bottleneck import (
    read_manager_deployment_bottleneck_state,
)
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

AUDIT_STATE_KEY = "manager_deployment_bottleneck_storage_audit_state"
WARNING_EVENT_COUNT = 80
MAX_EVENT_COUNT = 100


async def check_manager_deployment_bottleneck_storage_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    state_reader: Callable[[], dict[str, object]] | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    current = _to_utc(now)
    state = (state_reader or read_manager_deployment_bottleneck_state)()
    active = state.get("storage_warning_active") is True
    event_count = _count(state.get("retained_event_count"))
    current_state = {
        "active": active,
        "event_count": event_count,
        "alert_run_url": state.get("storage_warning_run_url"),
        "alerted_at": state.get("storage_warning_alerted_at"),
    }

    async with (session_factory or AsyncSessionLocal)() as session:
        repo = SQLiteSystemSettingsRepository(session)
        previous = _parse_state(await repo.get(AUDIT_STATE_KEY))
        was_active = previous.get("active") is True
        event = None
        if active and not was_active:
            event = "manager_deployment_bottleneck_storage_warning"
        elif not active and was_active:
            event = "manager_deployment_bottleneck_storage_recovered"

        if event:
            alert_state = current_state if active else previous
            await audit_service.record(
                db=session,
                actor="system",
                action="alert",
                resource_type="manager_component",
                resource_id="deployment-bottleneck-storage",
                resource_name="Manager 배포 병목 이벤트",
                detail={
                    "event": event,
                    "event_count": event_count,
                    "previous_event_count": previous.get("event_count"),
                    "warning_event_count": WARNING_EVENT_COUNT,
                    "max_event_count": MAX_EVENT_COUNT,
                    "alert_run_url": alert_state.get("alert_run_url"),
                    "alerted_at": alert_state.get("alerted_at"),
                    "checked_at": current.isoformat(),
                },
            )
        state_changed = False
        if active and current_state != previous:
            await repo.set(AUDIT_STATE_KEY, json.dumps(current_state, sort_keys=True))
            state_changed = True
        elif not active and previous:
            await repo.set(AUDIT_STATE_KEY, None)
            state_changed = True
        if event or state_changed:
            await session.commit()

    return {
        "checked_at": current.isoformat(),
        "status": "warning" if active else "healthy",
        "event": event,
        "event_count": event_count,
    }


def _parse_state(raw: str | None) -> dict[str, object]:
    try:
        value = json.loads(raw or "")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _count(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    return (
        current.replace(tzinfo=timezone.utc)
        if current.tzinfo is None
        else current.astimezone(timezone.utc)
    )
