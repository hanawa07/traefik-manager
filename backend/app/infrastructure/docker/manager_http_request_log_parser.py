import json
from datetime import datetime, timezone


def parse_manager_http_request_log(
    line: str,
) -> tuple[datetime, str, int, float | None] | None:
    json_start = line.find("{")
    if json_start < 0:
        return None
    try:
        payload = json.loads(line[json_start:])
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(payload, dict) or payload.get("message") != "요청 완료":
        return None

    path = payload.get("path")
    status_code = payload.get("status_code")
    duration_value = payload.get("duration_ms")
    occurred_at = _parse_timestamp(payload.get("time"))
    if (
        occurred_at is None
        or not isinstance(path, str)
        or not path.startswith("/api/")
        or isinstance(status_code, bool)
        or not isinstance(status_code, int)
    ):
        return None
    duration_ms = (
        float(duration_value)
        if isinstance(duration_value, (int, float))
        and not isinstance(duration_value, bool)
        and duration_value >= 0
        else None
    )
    return occurred_at, path, status_code, duration_ms


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
