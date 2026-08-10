from datetime import datetime, timezone

from app.infrastructure.docker.manager_http_client_cancellations import (
    build_manager_http_client_cancellation_summary,
    parse_manager_traefik_access_log,
)


CHECKED_AT = datetime(2026, 7, 14, 6, 30, tzinfo=timezone.utc)


def _access_log(
    *,
    occurred_at: str,
    path: str,
    status_code: int,
    router: str = "traefik-manager-tailnet-file@file",
) -> str:
    return (
        "2026-07-14T06:30:00.000000000Z 192.0.2.10 - - "
        f'[{occurred_at}] "GET {path} HTTP/1.1" {status_code} 21 '
        f'"-" "Mozilla/5.0" 123 "{router}" '
        '"http://traefik-manager-frontend-blue:3000" 10ms'
    )


def test_parse_manager_traefik_access_log_normalizes_api_path() -> None:
    request = parse_manager_traefik_access_log(
        _access_log(
            occurred_at="14/Jul/2026:06:20:00 +0000",
            path="/api/v1/settings/smoke-rotation?refresh=true",
            status_code=499,
        )
    )

    assert request == (
        datetime(2026, 7, 14, 6, 20, tzinfo=timezone.utc),
        "/api/v1/settings/smoke-rotation",
        499,
    )


def test_parse_manager_traefik_access_log_rejects_unrelated_lines() -> None:
    wrong_router = _access_log(
        occurred_at="14/Jul/2026:06:20:00 +0000",
        path="/api/v1/services",
        status_code=499,
        router="hanastay-co-kr@file",
    )
    frontend_path = _access_log(
        occurred_at="14/Jul/2026:06:20:00 +0000",
        path="/dashboard",
        status_code=499,
    )

    assert parse_manager_traefik_access_log(wrong_router) is None
    assert parse_manager_traefik_access_log(frontend_path) is None
    assert parse_manager_traefik_access_log("not-an-access-log") is None


def test_build_manager_http_client_cancellation_summary_uses_recent_sample() -> None:
    log_text = "\n".join(
        [
            _access_log(
                occurred_at="14/Jul/2026:01:30:00 +0000",
                path="/api/health",
                status_code=200,
            ),
            _access_log(
                occurred_at="14/Jul/2026:05:30:00 +0000",
                path="/api/v1/services?page=1",
                status_code=499,
            ),
            _access_log(
                occurred_at="14/Jul/2026:06:00:00 +0000",
                path="/api/v1/services?page=2",
                status_code=499,
            ),
            _access_log(
                occurred_at="14/Jul/2026:06:10:00 +0000",
                path="/api/v1/middlewares",
                status_code=499,
            ),
            _access_log(
                occurred_at="13/Jul/2026:23:30:00 +0000",
                path="/api/v1/services",
                status_code=499,
            ),
        ]
    )

    summary = build_manager_http_client_cancellation_summary(
        log_text,
        checked_at=CHECKED_AT,
        window_hours=6,
        path_filter="services",
    )

    assert summary["available"] is True
    assert summary["observed_since"] == datetime(
        2026, 7, 14, 1, 30, tzinfo=timezone.utc
    )
    assert summary["sample_coverage_percent"] == 83
    assert summary["count"] == 2
    assert summary["top_paths"] == [
        {
            "path": "/api/v1/services",
            "count": 2,
            "last_seen_at": datetime(2026, 7, 14, 6, 0, tzinfo=timezone.utc),
        }
    ]


def test_build_manager_http_client_cancellation_summary_marks_unavailable_logs() -> None:
    summary = build_manager_http_client_cancellation_summary(
        None,
        checked_at=CHECKED_AT,
        window_hours=24,
    )

    assert summary["available"] is False
    assert summary["observed_since"] is None
    assert summary["sample_coverage_percent"] == 0
    assert summary["count"] == 0
    assert summary["top_paths"] == []
