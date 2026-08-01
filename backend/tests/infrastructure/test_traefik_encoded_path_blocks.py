from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.infrastructure.traefik import traefik_api_client as traefik_client_module
from app.infrastructure.traefik.encoded_path_block_history import (
    read_recent_encoded_path_block_count,
    update_encoded_path_block_history,
)
from app.infrastructure.traefik.encoded_path_blocks import (
    parse_encoded_path_block_events,
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
    events = parse_encoded_path_block_events(raw_text)

    assert len(events) == 2
    assert events[0]["encoded_characters"] == ["%2F"]
    assert events[1]["encoded_characters"] == ["%5C", "%3B"]
    assert events[1]["occurred_at"] == datetime(
        2026, 8, 1, 11, 14, 42, tzinfo=timezone.utc
    )


def test_encoded_path_blocks_count_each_character_once_per_request():
    raw_text = (
        '2026-08-01T11:14:41Z 192.0.2.1 - - '
        '"GET /api%2Fnested%2Fpath%252F HTTP/2.0" 400 0'
    )

    events = parse_encoded_path_block_events(raw_text)

    assert len(events) == 1
    assert events[0]["encoded_characters"] == ["%2F", "%25"]


@pytest.mark.asyncio
async def test_traefik_client_builds_encoded_path_blocks_from_docker_logs(monkeypatch):
    collector = AsyncMock(return_value={"available": True, "blocked_request_count": 1})
    monkeypatch.setattr(
        traefik_client_module,
        "collect_encoded_path_block_history",
        collector,
    )

    result = await TraefikApiClient().get_encoded_path_blocks()

    assert result["available"] is True
    assert result["blocked_request_count"] == 1
    collector.assert_awaited_once()


def test_encoded_path_history_persists_deduplicated_private_summary(tmp_path):
    history_path = tmp_path / "encoded-path-blocks.json"
    checked_at = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
    raw_text = "\n".join(
        [
            '2026-08-01T11:14:41Z 192.0.2.1 - - "GET /private%2Fpath HTTP/2.0" 400 0',
            '2026-08-01T11:14:42Z 192.0.2.2 - - "GET /admin%3Btest HTTP/2.0" 400 0',
        ]
    )

    first = update_encoded_path_block_history(
        raw_text,
        checked_at=checked_at,
        path=history_path,
        tail_lines=2000,
    )
    second = update_encoded_path_block_history(
        raw_text,
        checked_at=checked_at,
        path=history_path,
        tail_lines=2000,
    )

    assert first["blocked_request_count"] == 2
    assert second["blocked_request_count"] == 2
    assert len(second["buckets"]) == 24
    assert sum(bucket["blocked_request_count"] for bucket in second["buckets"]) == 2
    stored = history_path.read_text(encoding="utf-8")
    assert "192.0.2" not in stored
    assert "private" not in stored
    assert "%2F" in stored


def test_encoded_path_history_survives_log_disconnect_and_prunes_old_data(tmp_path):
    history_path = tmp_path / "encoded-path-blocks.json"
    first_checked_at = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
    update_encoded_path_block_history(
        '2026-08-01T11:00:00Z 192.0.2.1 - - "GET /api%00health HTTP/2.0" 400 0',
        checked_at=first_checked_at,
        path=history_path,
        tail_lines=2000,
    )

    disconnected = update_encoded_path_block_history(
        None,
        checked_at=first_checked_at,
        path=history_path,
        tail_lines=2000,
    )
    pruned = update_encoded_path_block_history(
        None,
        checked_at=datetime(2026, 8, 2, 13, 0, tzinfo=timezone.utc),
        path=history_path,
        tail_lines=2000,
    )

    assert disconnected["available"] is True
    assert disconnected["collection_available"] is False
    assert disconnected["blocked_request_count"] == 1
    assert pruned["blocked_request_count"] == 0


def test_encoded_path_history_reports_unavailable_without_log_or_saved_state(tmp_path):
    result = update_encoded_path_block_history(
        None,
        checked_at=datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc),
        path=tmp_path / "missing.json",
        tail_lines=2000,
    )

    assert result["available"] is False
    assert result["collection_available"] is False
    assert len(result["buckets"]) == 24


def test_encoded_path_history_counts_only_recent_minute_buckets(tmp_path):
    history_path = tmp_path / "encoded-path-blocks.json"
    checked_at = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
    update_encoded_path_block_history(
        "\n".join(
            [
                '2026-08-01T11:44:59Z 192.0.2.1 - - "GET /old%2Fpath HTTP/2.0" 400 0',
                '2026-08-01T11:45:01Z 192.0.2.1 - - "GET /new%2Fpath HTTP/2.0" 400 0',
                '2026-08-01T11:59:59Z 192.0.2.1 - - "GET /latest%2Fpath HTTP/2.0" 400 0',
            ]
        ),
        checked_at=checked_at,
        path=history_path,
        tail_lines=2000,
    )

    count = read_recent_encoded_path_block_count(
        checked_at=checked_at,
        window_minutes=15,
        path=history_path,
    )

    assert count == 2
