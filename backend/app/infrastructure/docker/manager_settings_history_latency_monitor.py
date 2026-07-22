import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.application.audit import audit_service
from app.application.manager_health_monitoring import read_manager_health_monitoring_values
from app.infrastructure.docker.manager_http_latency import (
    SETTINGS_HISTORY_LATENCY_MINIMUM_SAMPLES,
    SETTINGS_HISTORY_LATENCY_PATH,
    SETTINGS_HISTORY_LATENCY_THRESHOLD_MS,
    SETTINGS_HISTORY_LATENCY_WINDOW_MINUTES,
)
from app.infrastructure.docker.manager_http_log_reader import (
    read_manager_settings_history_latency,
)
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

logger = logging.getLogger(__name__)

MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY = "manager_settings_history_latency_state"
MANAGER_SETTINGS_HISTORY_LATENCY_CHECK_INTERVAL_SECONDS = 5 * 60


async def check_manager_settings_history_latency_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    latency_reader: Callable[..., Any] | None = None,
    now: datetime | None = None,
    cooldown_seconds: int | None = None,
    minimum_interval_seconds: int = MANAGER_SETTINGS_HISTORY_LATENCY_CHECK_INTERVAL_SECONDS,
    raise_on_error: bool = False,
) -> dict[str, object]:
    current = _to_utc(now)
    session_factory = session_factory or AsyncSessionLocal
    latency_reader = latency_reader or read_manager_settings_history_latency
    async with session_factory() as session:
        repo = SQLiteSystemSettingsRepository(session)
        enabled, configured_cooldown_minutes = await read_manager_health_monitoring_values(repo)
        previous = _parse_state(await repo.get(MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY))
        if not enabled:
            if previous:
                await repo.set(MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY, None)
                await session.commit()
            return _result(enabled=False)
        if _checked_recently(previous, current, minimum_interval_seconds):
            return _result(enabled=True, state=previous)

        effective_cooldown_seconds = (
            cooldown_seconds
            if cooldown_seconds is not None
            else configured_cooldown_minutes * 60
        )
        try:
            summary = await latency_reader(
                checked_at=current,
            )
        except Exception:
            logger.warning("설정 이력 API p95 점검 실패", exc_info=True)
            if raise_on_error:
                raise
            return _result(enabled=True, state=previous)

        if not summary.get("available"):
            state = {
                **previous,
                "available": False,
                "checked_at": current.isoformat(),
            }
            await _save_state(repo, state)
            await session.commit()
            return _result(enabled=True, state=state)

        ready = bool(summary.get("ready"))
        breached = bool(summary.get("breached"))
        was_active = bool(previous.get("alert_active"))
        alert_active = breached if ready else was_active
        event: str | None = None
        suppressed_count = 0
        if ready and breached and (
            not was_active
            or _alert_due(previous, current, effective_cooldown_seconds)
        ):
            event = "manager_settings_history_latency_high"
        elif ready and breached:
            suppressed_count = 1
        elif ready and was_active:
            event = "manager_settings_history_latency_recovered"

        state = {
            "available": True,
            "ready": ready,
            "alert_active": alert_active,
            "last_alert_at": current.isoformat()
            if event == "manager_settings_history_latency_high"
            else previous.get("last_alert_at"),
            "checked_at": current.isoformat(),
            "sample_count": int(summary.get("sample_count") or 0),
            "p95_ms": summary.get("p95_ms"),
        }
        await _save_state(repo, state)
        if event:
            await audit_service.record(
                db=session,
                actor="system",
                action="alert",
                resource_type="manager_component",
                resource_id="settings-test-history",
                resource_name="설정 이력 API",
                detail={
                    "event": event,
                    "path": SETTINGS_HISTORY_LATENCY_PATH,
                    "window_minutes": SETTINGS_HISTORY_LATENCY_WINDOW_MINUTES,
                    "sample_count": state["sample_count"],
                    "minimum_sample_count": SETTINGS_HISTORY_LATENCY_MINIMUM_SAMPLES,
                    "p95_ms": state["p95_ms"],
                    "threshold_ms": SETTINGS_HISTORY_LATENCY_THRESHOLD_MS,
                    "checked_at": current.isoformat(),
                    "cooldown_minutes": effective_cooldown_seconds // 60,
                },
            )
        await session.commit()
        return _result(
            enabled=True,
            state=state,
            recorded_event_count=int(event is not None),
            suppressed_count=suppressed_count,
        )


async def read_manager_settings_history_latency_status(repo: Any) -> dict[str, object]:
    enabled, _ = await read_manager_health_monitoring_values(repo)
    state = _parse_state(await repo.get(MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY))
    return _result(enabled=enabled, state=state)


async def _save_state(repo: Any, state: dict[str, object]) -> None:
    await repo.set(
        MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY,
        json.dumps(state, ensure_ascii=False, sort_keys=True),
    )


def _checked_recently(state: dict[str, object], now: datetime, interval_seconds: int) -> bool:
    checked_at = _parse_datetime(state.get("checked_at"))
    return bool(
        interval_seconds > 0
        and checked_at is not None
        and now - checked_at < timedelta(seconds=interval_seconds)
    )


def _alert_due(previous: dict[str, object], now: datetime, cooldown_seconds: int) -> bool:
    last_alert_at = _parse_datetime(previous.get("last_alert_at"))
    return last_alert_at is None or now - last_alert_at >= timedelta(seconds=cooldown_seconds)


def _parse_state(raw: str | None) -> dict[str, object]:
    if not raw:
        return {}
    try:
        state = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return state if isinstance(state, dict) else {}


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return _to_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return None


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _result(
    *,
    enabled: bool,
    state: dict[str, object] | None = None,
    recorded_event_count: int = 0,
    suppressed_count: int = 0,
) -> dict[str, object]:
    state = state or {}
    return {
        "enabled": enabled,
        "available": bool(state.get("available")),
        "ready": bool(state.get("ready")),
        "checked_at": state.get("checked_at"),
        "last_alert_at": state.get("last_alert_at"),
        "alert_active": bool(state.get("alert_active")),
        "path": SETTINGS_HISTORY_LATENCY_PATH,
        "window_minutes": SETTINGS_HISTORY_LATENCY_WINDOW_MINUTES,
        "sample_count": int(state.get("sample_count") or 0),
        "minimum_sample_count": SETTINGS_HISTORY_LATENCY_MINIMUM_SAMPLES,
        "p95_ms": state.get("p95_ms"),
        "threshold_ms": SETTINGS_HISTORY_LATENCY_THRESHOLD_MS,
        "recorded_event_count": recorded_event_count,
        "suppressed_count": suppressed_count,
    }
