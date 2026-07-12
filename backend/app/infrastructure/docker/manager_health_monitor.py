import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.application.manager_health_monitoring import read_manager_health_monitoring_values
from app.application.audit import audit_service
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

logger = logging.getLogger(__name__)

MANAGER_HEALTH_STATE_KEY = "manager_docker_health_alert_state"
MANAGER_HEALTH_CHECK_INTERVAL_SECONDS = 30


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _deserialize_state(raw: str | None) -> dict[str, dict[str, Any]]:
    if not raw:
        return {}
    try:
        loaded = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(loaded, dict):
        return {}
    return {str(key): value for key, value in loaded.items() if isinstance(value, dict)}


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return _to_utc(parsed)


def _alert_due(previous: dict[str, Any], now: datetime, cooldown_seconds: int) -> bool:
    last_alert_at = _parse_datetime(previous.get("last_unhealthy_alert_at"))
    return last_alert_at is None or now - last_alert_at >= timedelta(seconds=cooldown_seconds)


async def check_manager_health_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    client_factory: Callable[[], DockerClient] | None = None,
    now: datetime | None = None,
    cooldown_seconds: int | None = None,
    raise_on_error: bool = False,
) -> dict[str, Any]:
    current_time = _to_utc(now)
    session_factory = session_factory or AsyncSessionLocal
    client_factory = client_factory or DockerClient
    async with session_factory() as session:
        repo = SQLiteSystemSettingsRepository(session)
        previous_state = _deserialize_state(await repo.get(MANAGER_HEALTH_STATE_KEY))
        monitoring_enabled, configured_cooldown_minutes = (
            await read_manager_health_monitoring_values(repo)
        )
        if not monitoring_enabled:
            if previous_state:
                await repo.set(MANAGER_HEALTH_STATE_KEY, None)
                await session.commit()
            return _summary(current_time, 0, 0, 0, enabled=False)

        effective_cooldown_seconds = (
            cooldown_seconds
            if cooldown_seconds is not None
            else configured_cooldown_minutes * 60
        )
        try:
            components = await client_factory().inspect_manager_components()
        except Exception:
            logger.warning("Manager Docker health 점검 실패", exc_info=True)
            if raise_on_error:
                raise
            return _summary(current_time, 0, 0, 0, enabled=True)

        next_state = dict(previous_state)
        recorded_event_count = 0
        suppressed_count = 0
        unhealthy_count = 0
        for component in components:
            name = component.get("name")
            health_status = component.get("health_status")
            if not isinstance(name, str) or health_status not in {"healthy", "unhealthy"}:
                continue
            unhealthy_count += int(health_status == "unhealthy")
            previous = previous_state.get(name, {})
            previous_status = previous.get("status")
            transitioned = previous_status != health_status
            alert_active = bool(previous.get("alert_active"))
            event = None

            if health_status == "unhealthy":
                if (transitioned or not alert_active) and _alert_due(
                    previous,
                    current_time,
                    effective_cooldown_seconds,
                ):
                    event = "manager_docker_unhealthy"
                    alert_active = True
                elif transitioned:
                    alert_active = False
                    suppressed_count += 1
            else:
                if previous_status == "unhealthy" and alert_active:
                    event = "manager_docker_recovered"
                alert_active = False

            entry = {
                "status": health_status,
                "alert_active": alert_active,
                "status_changed_at": current_time.isoformat()
                if transitioned
                else previous.get("status_changed_at") or current_time.isoformat(),
                "last_unhealthy_alert_at": current_time.isoformat()
                if event == "manager_docker_unhealthy"
                else previous.get("last_unhealthy_alert_at"),
                "checked_at": current_time.isoformat(),
            }
            next_state[name] = entry
            if event is None:
                continue

            await audit_service.record(
                db=session,
                actor="system",
                action="alert",
                resource_type="manager_component",
                resource_id=name,
                resource_name=name,
                detail={
                    "event": event,
                    "previous_status": previous_status,
                    "health_status": health_status,
                    "failing_streak": component.get("health_failing_streak"),
                    "last_exit_code": component.get("health_last_exit_code"),
                    "health_checked_at": component.get("health_last_checked_at"),
                    "checked_at": current_time.isoformat(),
                    "cooldown_minutes": effective_cooldown_seconds // 60,
                },
            )
            recorded_event_count += 1

        await repo.set(
            MANAGER_HEALTH_STATE_KEY,
            json.dumps(next_state, ensure_ascii=False, sort_keys=True),
        )
        await session.commit()
        return _summary(
            current_time,
            unhealthy_count,
            recorded_event_count,
            suppressed_count,
            enabled=True,
        )


async def run_periodic_manager_health_check(
    *,
    interval_seconds: int,
    check_once: Callable[[], Any],
) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        await check_once()


def _summary(
    current_time: datetime,
    unhealthy_count: int,
    recorded_event_count: int,
    suppressed_count: int,
    *,
    enabled: bool,
) -> dict[str, Any]:
    return {
        "enabled": enabled,
        "checked_at": current_time.isoformat(),
        "unhealthy_count": unhealthy_count,
        "recorded_event_count": recorded_event_count,
        "suppressed_count": suppressed_count,
    }
