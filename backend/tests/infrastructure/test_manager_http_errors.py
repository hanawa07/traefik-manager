import json
from datetime import datetime, timedelta, timezone

from app.infrastructure.docker.manager_http_errors import (
    build_manager_http_error_summary,
    count_manager_http_errors,
)


CHECKED_AT = datetime(2026, 7, 14, 6, 30, tzinfo=timezone.utc)


def _request_log(*, hours_ago: float, path: str, status_code: int) -> str:
    occurred_at = CHECKED_AT - timedelta(hours=hours_ago)
    payload = {
        "time": occurred_at.isoformat().replace("+00:00", "Z"),
        "level": "INFO",
        "message": "요청 완료",
        "path": path,
        "status_code": status_code,
    }
    return f"{occurred_at.isoformat()} {json.dumps(payload, ensure_ascii=False)}"


def test_build_manager_http_error_summary_groups_recent_404_and_5xx() -> None:
    log_text = "\n".join(
        [
            _request_log(hours_ago=23.5, path="/api/v1/middlewares", status_code=404),
            _request_log(hours_ago=2, path="/api/v1/middlewares", status_code=500),
            _request_log(hours_ago=1, path="/api/v1/services", status_code=503),
            _request_log(hours_ago=0.5, path="/api/v1/services", status_code=401),
            _request_log(hours_ago=25, path="/api/v1/old", status_code=404),
            "not-json",
        ]
    )

    summary = build_manager_http_error_summary(log_text, checked_at=CHECKED_AT)

    assert summary["available"] is True
    assert summary["not_found_count"] == 1
    assert summary["server_error_count"] == 2
    assert len(summary["buckets"]) == 24
    assert sum(bucket["not_found_count"] for bucket in summary["buckets"]) == 1
    assert sum(bucket["server_error_count"] for bucket in summary["buckets"]) == 2
    assert [item["path"] for item in summary["top_paths"]] == [
        "/api/v1/middlewares",
        "/api/v1/services",
    ]
    assert summary["observed_since"] == CHECKED_AT - timedelta(hours=25)


def test_build_manager_http_error_summary_rejects_non_request_and_frontend_paths() -> None:
    payloads = [
        json.dumps(
            {
                "time": CHECKED_AT.isoformat(),
                "message": "처리되지 않은 서버 오류",
                "path": "/api/v1/services",
                "status_code": 500,
            },
            ensure_ascii=False,
        ),
        _request_log(hours_ago=1, path="/dashboard/missing", status_code=404),
    ]

    summary = build_manager_http_error_summary("\n".join(payloads), checked_at=CHECKED_AT)

    assert summary["not_found_count"] == 0
    assert summary["server_error_count"] == 0
    assert summary["top_paths"] == []


def test_build_manager_http_error_summary_marks_unavailable_logs() -> None:
    summary = build_manager_http_error_summary(None, checked_at=CHECKED_AT)

    assert summary["available"] is False
    assert summary["observed_since"] is None
    assert len(summary["buckets"]) == 24


def test_build_manager_http_error_summary_filters_period_and_path() -> None:
    log_text = "\n".join(
        [
            _request_log(hours_ago=5, path="/api/v1/services", status_code=404),
            _request_log(hours_ago=4, path="/api/v1/middlewares", status_code=500),
            _request_log(hours_ago=8, path="/api/v1/services", status_code=404),
        ]
    )

    summary = build_manager_http_error_summary(
        log_text,
        checked_at=CHECKED_AT,
        window_hours=6,
        path_filter=" SERVICES ",
    )

    assert summary["window_hours"] == 6
    assert summary["path_filter"] == "services"
    assert summary["not_found_count"] == 1
    assert summary["server_error_count"] == 0
    assert len(summary["buckets"]) == 6
    assert [item["path"] for item in summary["top_paths"]] == ["/api/v1/services"]


def test_count_manager_http_errors_uses_minute_window() -> None:
    log_text = "\n".join(
        [
            _request_log(hours_ago=0.1, path="/api/v1/services", status_code=404),
            _request_log(hours_ago=0.2, path="/api/v1/services", status_code=503),
            _request_log(hours_ago=0.5, path="/api/v1/old", status_code=500),
        ]
    )

    counts = count_manager_http_errors(
        log_text,
        checked_at=CHECKED_AT,
        window_minutes=15,
    )

    assert counts["not_found_count"] == 1
    assert counts["server_error_count"] == 1
    assert counts["top_paths"][0]["path"] == "/api/v1/services"


def test_count_manager_http_errors_excludes_configured_path_prefixes() -> None:
    log_text = "\n".join(
        [
            _request_log(hours_ago=0.1, path="/api/v1/health", status_code=404),
            _request_log(hours_ago=0.1, path="/api/v1/health/deep", status_code=500),
            _request_log(hours_ago=0.1, path="/api/v1/services", status_code=503),
        ]
    )

    counts = count_manager_http_errors(
        log_text,
        checked_at=CHECKED_AT,
        window_minutes=15,
        excluded_paths=("/api/v1/health",),
    )

    assert counts["not_found_count"] == 0
    assert counts["server_error_count"] == 1
    assert [item["path"] for item in counts["top_paths"]] == ["/api/v1/services"]
