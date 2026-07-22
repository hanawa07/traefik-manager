import json
from datetime import datetime, timedelta, timezone

from app.infrastructure.docker.manager_http_latency import (
    build_settings_history_latency_summary,
)

CHECKED_AT = datetime(2026, 7, 23, 1, 0, tzinfo=timezone.utc)


def _request_log(*, minutes_ago: int, path: str, duration_ms: float | None) -> str:
    occurred_at = CHECKED_AT - timedelta(minutes=minutes_ago)
    payload = {
        "time": occurred_at.isoformat(),
        "message": "요청 완료",
        "path": path,
        "status_code": 200,
    }
    if duration_ms is not None:
        payload["duration_ms"] = duration_ms
    return json.dumps(payload, ensure_ascii=False)


def test_settings_history_latency_uses_recent_nearest_rank_p95() -> None:
    log_text = "\n".join(
        [
            _request_log(
                minutes_ago=index,
                path="/api/v1/settings/test-history",
                duration_ms=duration,
            )
            for index, duration in enumerate([20, 30, 40, 50, 800])
        ]
        + [
            _request_log(
                minutes_ago=61,
                path="/api/v1/settings/test-history",
                duration_ms=500,
            ),
            _request_log(minutes_ago=1, path="/api/v1/services", duration_ms=900),
            _request_log(
                minutes_ago=1,
                path="/api/v1/settings/test-history",
                duration_ms=None,
            ),
        ]
    )

    result = build_settings_history_latency_summary(log_text, checked_at=CHECKED_AT)

    assert result["available"] is True
    assert result["ready"] is True
    assert result["sample_count"] == 5
    assert result["p95_ms"] == 800
    assert result["threshold_ms"] == 750
    assert result["breached"] is True


def test_settings_history_latency_waits_for_minimum_samples() -> None:
    result = build_settings_history_latency_summary(
        _request_log(
            minutes_ago=1,
            path="/api/v1/settings/test-history",
            duration_ms=300,
        ),
        checked_at=CHECKED_AT,
    )

    assert result["sample_count"] == 1
    assert result["p95_ms"] == 300
    assert result["ready"] is False
    assert result["breached"] is False


def test_settings_history_latency_marks_missing_logs_unavailable() -> None:
    result = build_settings_history_latency_summary(None, checked_at=CHECKED_AT)

    assert result["available"] is False
    assert result["sample_count"] == 0
    assert result["p95_ms"] is None
