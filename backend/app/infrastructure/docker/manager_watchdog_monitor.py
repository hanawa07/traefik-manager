from datetime import datetime, timezone
from typing import Any, Callable

from app.application.audit import audit_service
from app.application.manager_health_monitoring import read_external_watchdog_stale_minutes
from app.core.manager_watchdog_state import read_manager_watchdog_state
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

WATCHDOG_AUDIT_STATE_KEY = "external_watchdog_stale_audit_state"


async def check_watchdog_staleness_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    state_reader: Callable[..., dict[str, object]] | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    else:
        current_time = current_time.astimezone(timezone.utc)
    session_factory = session_factory or AsyncSessionLocal
    state_reader = state_reader or read_manager_watchdog_state

    async with session_factory() as session:
        repo = SQLiteSystemSettingsRepository(session)
        stale_after_minutes = await read_external_watchdog_stale_minutes(repo)
        state = state_reader(now=current_time, stale_after_minutes=stale_after_minutes)
        watchdog_checked_at = state.get("external_watchdog_checked_at")
        if state.get("external_watchdog_status") == "unknown" or not isinstance(
            watchdog_checked_at, datetime
        ):
            return {
                "checked_at": current_time.isoformat(),
                "status": "unknown",
                "event": None,
                "stale_after_minutes": stale_after_minutes,
            }
        current_status = "stale" if state["external_watchdog_stale"] else "healthy"
        previous_status = await repo.get(WATCHDOG_AUDIT_STATE_KEY)
        event = None
        if current_status == "stale" and previous_status != "stale":
            event = "manager_watchdog_stale"
        elif current_status == "healthy" and previous_status == "stale":
            event = "manager_watchdog_recovered"

        if current_status != previous_status:
            await repo.set(WATCHDOG_AUDIT_STATE_KEY, current_status)
            if event:
                await audit_service.record(
                    db=session,
                    actor="system",
                    action="alert",
                    resource_type="manager_component",
                    resource_id="external-watchdog",
                    resource_name="외부 watchdog",
                    detail={
                        "event": event,
                        "previous_status": previous_status or "unknown",
                        "watchdog_status": state.get("external_watchdog_status"),
                        "watchdog_checked_at": watchdog_checked_at.isoformat(),
                        "checked_at": current_time.isoformat(),
                        "stale_after_minutes": stale_after_minutes,
                        "consecutive_failures": state.get(
                            "external_watchdog_consecutive_failures"
                        ),
                    },
                )
            await session.commit()

        return {
            "checked_at": current_time.isoformat(),
            "status": current_status,
            "event": event,
            "stale_after_minutes": stale_after_minutes,
        }
