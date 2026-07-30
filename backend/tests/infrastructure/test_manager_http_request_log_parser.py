import json
from datetime import datetime, timezone

from app.infrastructure.docker.manager_http_request_log_parser import (
    parse_manager_http_request_log,
)


def test_parse_manager_http_request_log_normalizes_valid_request() -> None:
    payload = {
        "time": "2026-07-31T09:15:00+09:00",
        "message": "요청 완료",
        "path": "/api/v1/services",
        "status_code": 200,
        "duration_ms": 12.5,
    }

    result = parse_manager_http_request_log(
        f"backend | {json.dumps(payload, ensure_ascii=False)}"
    )

    assert result == (
        datetime(2026, 7, 31, 0, 15, tzinfo=timezone.utc),
        "/api/v1/services",
        200,
        12.5,
    )


def test_parse_manager_http_request_log_rejects_unrelated_or_invalid_payload() -> None:
    invalid_payloads = [
        "not-json",
        json.dumps(
            {
                "time": "2026-07-31T00:00:00Z",
                "message": "처리되지 않은 서버 오류",
                "path": "/api/v1/services",
                "status_code": 500,
            },
            ensure_ascii=False,
        ),
        json.dumps(
            {
                "time": "2026-07-31T00:00:00Z",
                "message": "요청 완료",
                "path": "/dashboard",
                "status_code": 200,
            },
            ensure_ascii=False,
        ),
        json.dumps(
            {
                "time": "invalid",
                "message": "요청 완료",
                "path": "/api/v1/services",
                "status_code": True,
            },
            ensure_ascii=False,
        ),
    ]

    assert all(parse_manager_http_request_log(line) is None for line in invalid_payloads)
