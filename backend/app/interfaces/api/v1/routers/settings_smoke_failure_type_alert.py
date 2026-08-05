import json
from datetime import datetime
from typing import Any

from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    build_smoke_failure_type_increase_alerts,
    read_smoke_failure_metadata,
)
from app.interfaces.api.v1.routers.settings_smoke_monitoring_values import (
    SMOKE_FAILURE_TYPE_ALERT_ENABLED_KEY,
    SMOKE_FAILURE_TYPE_ALERT_STATE_KEY,
)
from app.interfaces.api.v1.routers.settings_value_helpers import get_bool_setting

FAILURE_TYPE_LABELS = {
    "login": "로그인",
    "external_api": "외부 API",
    "visual_regression": "화면 회귀",
}


async def record_smoke_failure_type_increase_alerts(
    *,
    repo: Any,
    db: Any,
    audit_service: Any,
    actor: str,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    enabled = await get_bool_setting(
        repo,
        SMOKE_FAILURE_TYPE_ALERT_ENABLED_KEY,
        default=False,
    )
    if not enabled:
        if await repo.get(SMOKE_FAILURE_TYPE_ALERT_STATE_KEY) not in {None, "[]"}:
            await repo.set(SMOKE_FAILURE_TYPE_ALERT_STATE_KEY, "[]")
        return []

    alerts = build_smoke_failure_type_increase_alerts(
        await read_smoke_failure_metadata(repo),
        now=now,
    )
    active_types = {alert["failure_type"] for alert in alerts}
    previous_types = await _read_active_types(repo)
    await repo.set(
        SMOKE_FAILURE_TYPE_ALERT_STATE_KEY,
        json.dumps(sorted(active_types)),
    )
    new_alerts = [
        alert for alert in alerts if alert["failure_type"] not in previous_types
    ]
    for alert in new_alerts:
        failure_type = alert["failure_type"]
        await audit_service.record(
            db=db,
            actor=actor,
            action="alert",
            resource_type="settings",
            resource_id="smoke_failure_type_increase",
            resource_name=FAILURE_TYPE_LABELS[failure_type],
            detail={
                "event": "smoke_failure_type_increase",
                "failure_type": failure_type,
                "recent_count": alert["recent_count"],
                "previous_count": alert["previous_count"],
                "window_days": 7,
            },
            notify=True,
        )
    return new_alerts


async def _read_active_types(repo: Any) -> set[str]:
    raw = await repo.get(SMOKE_FAILURE_TYPE_ALERT_STATE_KEY)
    try:
        payload = json.loads(raw or "[]")
    except (TypeError, ValueError):
        return set()
    if not isinstance(payload, list):
        return set()
    return {item for item in payload if item in FAILURE_TYPE_LABELS}
