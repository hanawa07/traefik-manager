import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from app.application.audit import audit_service
from app.application.encoded_path_block_monitoring import (
    ENCODED_PATH_BLOCK_STATE_KEY,
    parse_encoded_path_block_monitor_state,
    read_encoded_path_block_monitoring_values,
)
from app.application.manager_health_monitoring import (
    read_manager_health_monitoring_values,
)
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.traefik.encoded_path_block_history import (
    collect_encoded_path_block_history,
    read_recent_encoded_path_block_count,
)


async def check_encoded_path_blocks_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    now: datetime | None = None,
    history_path: str | Path | None = None,
    cooldown_seconds: int | None = None,
) -> dict[str, object]:
    current = _to_utc(now)
    session_factory = session_factory or AsyncSessionLocal
    async with session_factory() as session:
        repo = SQLiteSystemSettingsRepository(session)
        monitoring = await read_encoded_path_block_monitoring_values(repo)
        previous = parse_encoded_path_block_monitor_state(
            await repo.get(ENCODED_PATH_BLOCK_STATE_KEY)
        )
        history = await collect_encoded_path_block_history(
            checked_at=current,
            path=history_path,
        )

        if not monitoring.enabled:
            if previous:
                await repo.set(ENCODED_PATH_BLOCK_STATE_KEY, None)
                await session.commit()
            return _summary(current, enabled=False, available=False)

        if not history.get("available") or not history.get("collection_available"):
            return _summary(current, enabled=True, available=False)

        blocked_count = read_recent_encoded_path_block_count(
            checked_at=current,
            window_minutes=monitoring.window_minutes,
            path=history_path,
        )
        if blocked_count is None:
            return _summary(current, enabled=True, available=False)

        _, configured_cooldown_minutes = await read_manager_health_monitoring_values(repo)
        effective_cooldown_seconds = (
            cooldown_seconds
            if cooldown_seconds is not None
            else configured_cooldown_minutes * 60
        )
        breached = blocked_count >= monitoring.threshold
        was_active = bool(previous.get("alert_active"))
        event: str | None = None
        suppressed_count = 0
        if breached and (
            not was_active
            or _alert_due(previous, current, effective_cooldown_seconds)
        ):
            event = "traefik_encoded_path_blocks_high"
        elif breached:
            suppressed_count = 1
        elif was_active:
            event = "traefik_encoded_path_blocks_recovered"

        state = {
            "alert_active": breached,
            "last_alert_at": current.isoformat()
            if event == "traefik_encoded_path_blocks_high"
            else previous.get("last_alert_at"),
            "blocked_request_count": blocked_count,
        }
        await repo.set(
            ENCODED_PATH_BLOCK_STATE_KEY,
            json.dumps(state, ensure_ascii=False, sort_keys=True),
        )
        if event:
            await audit_service.record(
                db=session,
                actor="system",
                action="alert",
                resource_type="traefik_security",
                resource_id="encoded-path-blocks",
                resource_name="Traefik 인코딩 경로 차단",
                detail={
                    "event": event,
                    "window_minutes": monitoring.window_minutes,
                    "blocked_request_count": blocked_count,
                    "alert_threshold": monitoring.threshold,
                    "checked_at": current.isoformat(),
                    "cooldown_minutes": effective_cooldown_seconds // 60,
                },
            )
        await session.commit()
        return _summary(
            current,
            enabled=True,
            available=True,
            breached=breached,
            blocked_count=blocked_count,
            recorded_event_count=int(event is not None),
            suppressed_count=suppressed_count,
        )


def _alert_due(previous: dict[str, object], now: datetime, cooldown_seconds: int) -> bool:
    value = previous.get("last_alert_at")
    if not isinstance(value, str):
        return True
    try:
        last_alert_at = _to_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return True
    return now - last_alert_at >= timedelta(seconds=cooldown_seconds)


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _summary(
    current: datetime,
    *,
    enabled: bool,
    available: bool,
    breached: bool = False,
    blocked_count: int = 0,
    recorded_event_count: int = 0,
    suppressed_count: int = 0,
) -> dict[str, object]:
    return {
        "enabled": enabled,
        "available": available,
        "checked_at": current.isoformat(),
        "breached": breached,
        "blocked_request_count": blocked_count,
        "recorded_event_count": recorded_event_count,
        "suppressed_count": suppressed_count,
    }
