import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.application.audit import audit_service
from app.application.manager_health_monitoring import read_manager_health_monitoring_values
from app.application.manager_http_error_monitoring import (
    MANAGER_HTTP_ERROR_STATE_KEY,
    parse_manager_http_error_state,
    read_manager_http_error_monitoring_values,
)
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

logger = logging.getLogger(__name__)


async def check_manager_http_errors_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    client_factory: Callable[[], DockerClient] | None = None,
    now: datetime | None = None,
    cooldown_seconds: int | None = None,
    raise_on_error: bool = False,
) -> dict[str, object]:
    current = _to_utc(now)
    session_factory = session_factory or AsyncSessionLocal
    client_factory = client_factory or DockerClient
    async with session_factory() as session:
        repo = SQLiteSystemSettingsRepository(session)
        monitoring = await read_manager_http_error_monitoring_values(repo)
        previous = parse_manager_http_error_state(await repo.get(MANAGER_HTTP_ERROR_STATE_KEY))
        if not monitoring.enabled:
            if previous:
                await repo.set(MANAGER_HTTP_ERROR_STATE_KEY, None)
                await session.commit()
            return _summary(current, enabled=False, available=False)

        _, health_cooldown_minutes = await read_manager_health_monitoring_values(repo)
        effective_cooldown_seconds = (
            cooldown_seconds
            if cooldown_seconds is not None
            else health_cooldown_minutes * 60
        )
        counts: dict[str, object] | None = None
        try:
            counts = await client_factory().get_manager_http_error_counts(
                window_minutes=monitoring.window_minutes,
                checked_at=current,
                excluded_paths=monitoring.excluded_paths,
            )
        except Exception:
            logger.warning("Manager API 오류 임계치 점검 실패", exc_info=True)
            if raise_on_error:
                raise
        if not counts or not counts.get("available"):
            await repo.set(
                MANAGER_HTTP_ERROR_STATE_KEY,
                json.dumps(
                    {
                        **previous,
                        "available": False,
                        "checked_at": current.isoformat(),
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                ),
            )
            await session.commit()
            return _summary(current, enabled=True, available=False)

        not_found_count = int(counts["not_found_count"])
        server_error_count = int(counts["server_error_count"])
        breached = (
            not_found_count >= monitoring.not_found_threshold
            or server_error_count >= monitoring.server_error_threshold
        )
        was_active = bool(previous.get("alert_active"))
        event: str | None = None
        suppressed_count = 0
        if breached and (
            not was_active
            or _alert_due(previous, current, effective_cooldown_seconds)
        ):
            event = "manager_http_errors_high"
        elif breached:
            suppressed_count = 1
        elif was_active:
            event = "manager_http_errors_recovered"

        state = {
            "available": True,
            "alert_active": breached,
            "last_alert_at": current.isoformat()
            if event == "manager_http_errors_high"
            else previous.get("last_alert_at"),
            "checked_at": current.isoformat(),
            "not_found_count": not_found_count,
            "server_error_count": server_error_count,
        }
        await repo.set(
            MANAGER_HTTP_ERROR_STATE_KEY,
            json.dumps(state, ensure_ascii=False, sort_keys=True),
        )
        if event:
            await audit_service.record(
                db=session,
                actor="system",
                action="alert",
                resource_type="manager_component",
                resource_id="backend-api",
                resource_name="Manager API",
                detail={
                    "event": event,
                    "window_minutes": monitoring.window_minutes,
                    "not_found_count": not_found_count,
                    "not_found_threshold": monitoring.not_found_threshold,
                    "server_error_count": server_error_count,
                    "server_error_threshold": monitoring.server_error_threshold,
                    "excluded_paths": list(monitoring.excluded_paths),
                    "top_paths": _serialize_top_paths(counts.get("top_paths")),
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
            not_found_count=not_found_count,
            server_error_count=server_error_count,
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


def _serialize_top_paths(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    paths: list[dict[str, object]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        last_seen_at = item.get("last_seen_at")
        paths.append(
            {
                **item,
                "last_seen_at": last_seen_at.isoformat()
                if isinstance(last_seen_at, datetime)
                else last_seen_at,
            }
        )
    return paths


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
    not_found_count: int = 0,
    server_error_count: int = 0,
    recorded_event_count: int = 0,
    suppressed_count: int = 0,
) -> dict[str, object]:
    return {
        "enabled": enabled,
        "available": available,
        "checked_at": current.isoformat(),
        "breached": breached,
        "not_found_count": not_found_count,
        "server_error_count": server_error_count,
        "recorded_event_count": recorded_event_count,
        "suppressed_count": suppressed_count,
    }
