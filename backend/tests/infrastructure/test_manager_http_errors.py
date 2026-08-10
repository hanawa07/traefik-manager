import json
from datetime import datetime, timedelta, timezone

from app.infrastructure.docker.manager_http_errors import (
    build_manager_http_error_summary,
    count_manager_http_errors,
)
from app.infrastructure.docker.manager_http_error_preview import (
    build_manager_http_error_preview,
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
    assert summary["sample_coverage_percent"] == 100


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
    assert summary["sample_coverage_percent"] == 0
    assert len(summary["buckets"]) == 24


def test_build_manager_http_error_summary_keeps_499_out_of_server_errors() -> None:
    backend_log_text = _request_log(
        hours_ago=1,
        path="/api/v1/services",
        status_code=500,
    )
    traefik_log_text = "\n".join(
        [
            (
                '192.0.2.10 - - [14/Jul/2026:05:00:00 +0000] '
                '"GET /api/v1/services HTTP/1.1" 499 21 "-" "-" 123 '
                '"traefik-manager-tailnet-file@file" '
                '"http://traefik-manager-frontend-blue:3000" 10ms'
            ),
            (
                '192.0.2.10 - - [14/Jul/2026:05:30:00 +0000] '
                '"GET /api/v1/services?refresh=true HTTP/1.1" 499 21 "-" "-" 124 '
                '"traefik-manager-tailnet-file@file" '
                '"http://traefik-manager-frontend-blue:3000" 11ms'
            ),
        ]
    )

    summary = build_manager_http_error_summary(
        backend_log_text,
        checked_at=CHECKED_AT,
        client_cancellation_log_text=traefik_log_text,
    )

    assert summary["server_error_count"] == 1
    assert summary["client_cancellation"]["count"] == 2
    assert summary["client_cancellation"]["top_paths"][0]["path"] == (
        "/api/v1/services"
    )


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


def test_build_manager_http_error_summary_correlates_errors_with_deployment() -> None:
    started_at = CHECKED_AT - timedelta(minutes=12)
    completed_at = CHECKED_AT - timedelta(minutes=10)
    log_text = "\n".join(
        [
            _request_log(hours_ago=0.2, path="/api/v1/services", status_code=404),
            _request_log(hours_ago=0.15, path="/api/v1/services", status_code=503),
            _request_log(hours_ago=0.5, path="/api/v1/old", status_code=404),
        ]
    )
    deployment_history = [
        {
            "version": "v1.38.281",
            "revision": "a" * 40,
            "status": "success",
            "started_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
        },
        {
            "version": "v1.38.280",
            "revision": "b" * 40,
            "status": "success",
            "started_at": (CHECKED_AT - timedelta(hours=2)).isoformat(),
            "completed_at": (CHECKED_AT - timedelta(hours=1, minutes=58)).isoformat(),
        }
    ]

    summary = build_manager_http_error_summary(
        log_text,
        checked_at=CHECKED_AT,
        deployment_history=deployment_history,
    )

    assert len(summary["deployment_correlations"]) == 2
    correlation = summary["deployment_correlations"][0]
    assert correlation["version"] == "v1.38.281"
    assert correlation["window_started_at"] == started_at - timedelta(minutes=1)
    assert correlation["window_ended_at"] == completed_at + timedelta(minutes=2)
    assert correlation["sample_complete"] is True
    assert correlation["not_found_count"] == 1
    assert correlation["server_error_count"] == 1
    assert [item["path"] for item in correlation["top_paths"]] == [
        "/api/v1/services"
    ]
    assert summary["deployment_correlations"][1]["sample_complete"] is False


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


def test_build_manager_http_error_preview_recommends_thresholds_and_counts_exclusions() -> None:
    log_text = "\n".join(
        [
            *[
                _request_log(hours_ago=0.1, path="/api/v1/services", status_code=404)
                for _ in range(25)
            ],
            _request_log(hours_ago=0.1, path="/api/v1/services", status_code=500),
            _request_log(hours_ago=0.2, path="/api/v1/services", status_code=503),
            _request_log(hours_ago=2, path="/api/v1/services", status_code=502),
            _request_log(hours_ago=0.5, path="/api/v1/health", status_code=404),
            _request_log(hours_ago=0.4, path="/api/v1/health/deep", status_code=500),
            _request_log(hours_ago=3, path="/api/v1/session", status_code=200),
            _request_log(hours_ago=25, path="/api/v1/old", status_code=404),
        ]
    )

    preview = build_manager_http_error_preview(
        log_text,
        checked_at=CHECKED_AT,
        window_minutes=15,
        excluded_paths=("/api/v1/health", "/api/v1/health/deep"),
    )

    assert preview["available"] is True
    assert preview["observed_since"] == CHECKED_AT - timedelta(hours=25)
    assert preview["sample_coverage_percent"] == 100
    assert preview["peak_not_found_count"] == 25
    assert preview["peak_server_error_count"] == 2
    assert preview["recommended_not_found_threshold"] == 30
    assert preview["recommended_server_error_threshold"] == 3
    assert preview["excluded_paths"] == [
        {
            "path": "/api/v1/health",
            "not_found_count": 1,
            "server_error_count": 0,
            "last_seen_at": CHECKED_AT - timedelta(hours=0.5),
        },
        {
            "path": "/api/v1/health/deep",
            "not_found_count": 0,
            "server_error_count": 1,
            "last_seen_at": CHECKED_AT - timedelta(hours=0.4),
        },
    ]


def test_build_manager_http_error_preview_uses_safe_defaults_without_logs() -> None:
    preview = build_manager_http_error_preview(
        None,
        checked_at=CHECKED_AT,
        window_minutes=15,
        excluded_paths=("/api/v1/health",),
    )

    assert preview["available"] is False
    assert preview["sample_coverage_percent"] == 0
    assert preview["recommended_not_found_threshold"] == 20
    assert preview["recommended_server_error_threshold"] == 1
    assert preview["excluded_paths"] == [
        {
            "path": "/api/v1/health",
            "not_found_count": 0,
            "server_error_count": 0,
            "last_seen_at": None,
        }
    ]
