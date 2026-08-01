from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.infrastructure.traefik import traefik_api_client as traefik_client_module
from app.infrastructure.traefik.encoded_path_blocks import (
    build_encoded_path_block_summary,
)
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient


def test_encoded_path_blocks_count_only_reserved_encodings_in_400_paths():
    raw_text = "\n".join(
        [
            '2026-08-01T11:14:41Z 192.0.2.1 - - "GET /api%2fhealth HTTP/2.0" 400 0',
            '2026-08-01T11:14:42Z 192.0.2.1 - - "GET /admin%3B/%5Ctest HTTP/1.1" 400 0',
            '2026-08-01T11:14:43Z 192.0.2.1 - - "GET /_next/image?url=https%3A%2F%2Fexample.com HTTP/2.0" 400 0',
            '2026-08-01T11:14:44Z 192.0.2.1 - - "GET /api%23fragment HTTP/2.0" 200 12',
            '2026-08-01T11:14:45Z INF Traefik version 3.7.10 built on 2026-07-30',
        ]
    )
    checked_at = datetime(2026, 8, 1, 11, 15, tzinfo=timezone.utc)

    result = build_encoded_path_block_summary(
        raw_text,
        tail_lines=2000,
        checked_at=checked_at,
    )

    counts = {
        item["encoded"]: item["request_count"]
        for item in result["encoded_characters"]
    }
    assert result["available"] is True
    assert result["observed_log_lines"] == 5
    assert result["blocked_request_count"] == 2
    assert result["last_blocked_at"] == datetime(
        2026, 8, 1, 11, 14, 42, tzinfo=timezone.utc
    )
    assert counts["%2F"] == 1
    assert counts["%3B"] == 1
    assert counts["%5C"] == 1
    assert counts["%23"] == 0


def test_encoded_path_blocks_count_each_character_once_per_request():
    raw_text = (
        '2026-08-01T11:14:41Z 192.0.2.1 - - '
        '"GET /api%2Fnested%2Fpath%252F HTTP/2.0" 400 0'
    )

    result = build_encoded_path_block_summary(raw_text, tail_lines=100)
    counts = {
        item["encoded"]: item["request_count"]
        for item in result["encoded_characters"]
    }

    assert result["blocked_request_count"] == 1
    assert counts["%2F"] == 1
    assert counts["%25"] == 1


def test_encoded_path_blocks_report_unavailable_log_source():
    checked_at = datetime(2026, 8, 1, 11, 15, tzinfo=timezone.utc)

    result = build_encoded_path_block_summary(
        None,
        tail_lines=2000,
        checked_at=checked_at,
    )

    assert result["available"] is False
    assert result["checked_at"] == checked_at
    assert result["blocked_request_count"] == 0
    assert result["last_blocked_at"] is None


@pytest.mark.asyncio
async def test_traefik_client_builds_encoded_path_blocks_from_docker_logs(monkeypatch):
    log_reader = AsyncMock(
        return_value=(
            '2026-08-01T11:14:41Z 192.0.2.1 - - '
            '"GET /api%00health HTTP/2.0" 400 0'
        )
    )
    monkeypatch.setattr(
        traefik_client_module,
        "read_docker_container_logs_text",
        log_reader,
    )

    result = await TraefikApiClient().get_encoded_path_blocks()

    assert result["available"] is True
    assert result["blocked_request_count"] == 1
    log_reader.assert_awaited_once()
