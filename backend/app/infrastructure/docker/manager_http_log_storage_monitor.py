import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.application.audit import audit_service
from app.application.manager_health_monitoring import read_manager_health_monitoring_values
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

logger = logging.getLogger(__name__)

MANAGER_HTTP_LOG_STORAGE_STATE_KEY = "manager_http_log_storage_alert_state"
MANAGER_HTTP_LOG_STORAGE_WARNING_PERCENT = 80.0


async def check_manager_http_log_storage_once(
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
        enabled, configured_cooldown_minutes = await read_manager_health_monitoring_values(repo)
        previous = _parse_state(await repo.get(MANAGER_HTTP_LOG_STORAGE_STATE_KEY))
        if not enabled:
            if previous:
                await repo.set(MANAGER_HTTP_LOG_STORAGE_STATE_KEY, None)
                await session.commit()
            return _summary(current, enabled=False, available=False)

        effective_cooldown_seconds = (
            cooldown_seconds
            if cooldown_seconds is not None
            else configured_cooldown_minutes * 60
        )
        try:
            storage = await client_factory().get_manager_http_log_storage()
        except Exception:
            logger.warning("Manager 요청 로그 보관 상태 점검 실패", exc_info=True)
            if raise_on_error:
                raise
            return _summary(current, enabled=True, available=False)

        if not isinstance(storage, dict):
            return _summary(current, enabled=True, available=False)

        detail = _normalize_storage(storage)
        status = str(detail["status"])
        warning_active = status != "healthy"
        previous_status = previous.get("status")
        was_active = bool(previous.get("alert_active"))
        event: str | None = None
        if warning_active and (
            not was_active
            or previous_status != status
            or _alert_due(previous, current, effective_cooldown_seconds)
        ):
            event = "manager_http_log_storage_warning"
        elif not warning_active and was_active:
            event = "manager_http_log_storage_recovered"

        state = {
            "available": True,
            "alert_active": warning_active,
            "status": status,
            "last_alert_at": current.isoformat()
            if event == "manager_http_log_storage_warning"
            else previous.get("last_alert_at"),
            "checked_at": current.isoformat(),
        }
        await repo.set(
            MANAGER_HTTP_LOG_STORAGE_STATE_KEY,
            json.dumps(state, ensure_ascii=False, sort_keys=True),
        )
        if event:
            await audit_service.record(
                db=session,
                actor="system",
                action="alert",
                resource_type="manager_component",
                resource_id="request-log-storage",
                resource_name="Manager 요청 로그",
                detail={
                    "event": event,
                    "previous_status": previous_status,
                    **detail,
                    "checked_at": current.isoformat(),
                    "cooldown_minutes": effective_cooldown_seconds // 60,
                },
            )
        await session.commit()
        return _summary(
            current,
            enabled=True,
            available=True,
            status=status,
            recorded_event_count=int(event is not None),
            suppressed_count=int(warning_active and event is None),
        )


def _normalize_storage(storage: dict[str, object]) -> dict[str, object]:
    source = storage.get("source")
    if source not in {"persistent", "docker", "unavailable"}:
        source = "unavailable"
    size_bytes = _count(storage.get("size_bytes"))
    capacity_bytes = _count(storage.get("capacity_bytes"))
    raw_usage_percent = size_bytes / capacity_bytes * 100 if capacity_bytes > 0 else 0.0
    usage_percent = min(100.0, round(raw_usage_percent, 1))
    status = "healthy"
    if source in {"docker", "unavailable"}:
        status = source
    elif raw_usage_percent >= MANAGER_HTTP_LOG_STORAGE_WARNING_PERCENT:
        status = "capacity"
    return {
        "status": status,
        "source": source,
        "size_bytes": size_bytes,
        "capacity_bytes": capacity_bytes,
        "usage_percent": usage_percent,
        "file_count": _count(storage.get("file_count")),
        "max_file_count": _count(storage.get("max_file_count")),
        "rotated_file_count": _count(storage.get("rotated_file_count")),
        "warning_threshold_percent": MANAGER_HTTP_LOG_STORAGE_WARNING_PERCENT,
    }


def _parse_state(raw: str | None) -> dict[str, object]:
    try:
        value = json.loads(raw or "")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _alert_due(previous: dict[str, object], now: datetime, cooldown_seconds: int) -> bool:
    value = previous.get("last_alert_at")
    if not isinstance(value, str):
        return True
    try:
        last_alert_at = _to_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return True
    return now - last_alert_at >= timedelta(seconds=cooldown_seconds)


def _count(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    return (
        current.replace(tzinfo=timezone.utc)
        if current.tzinfo is None
        else current.astimezone(timezone.utc)
    )


def _summary(
    current: datetime,
    *,
    enabled: bool,
    available: bool,
    status: str = "unknown",
    recorded_event_count: int = 0,
    suppressed_count: int = 0,
) -> dict[str, object]:
    return {
        "enabled": enabled,
        "available": available,
        "checked_at": current.isoformat(),
        "status": status,
        "recorded_event_count": recorded_event_count,
        "suppressed_count": suppressed_count,
    }
