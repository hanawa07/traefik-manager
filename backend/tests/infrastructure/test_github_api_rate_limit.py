import asyncio
from datetime import datetime, timezone

import pytest

from app.infrastructure import github_api_rate_limit


def test_github_api_rate_limit_keeps_lowest_remaining_for_same_window(monkeypatch) -> None:
    monkeypatch.setattr(github_api_rate_limit, "_latest_rate_limit", None)
    monkeypatch.setattr(github_api_rate_limit, "_latest_secondary_retry_at", None)
    headers = {
        "x-ratelimit-remaining": "42",
        "x-ratelimit-limit": "60",
        "x-ratelimit-reset": "1800000000",
    }

    github_api_rate_limit.record_github_api_rate_limit(headers)
    github_api_rate_limit.record_github_api_rate_limit(
        {**headers, "x-ratelimit-remaining": "45"},
    )
    github_api_rate_limit.record_github_api_rate_limit(
        {**headers, "x-ratelimit-remaining": "invalid"},
    )

    assert github_api_rate_limit.read_github_api_rate_limit() == {
        "remaining": 42,
        "limit": 60,
        "reset_at": "2027-01-15T08:00:00+00:00",
        "secondary_retry_at": None,
    }


def test_github_api_rate_limit_blocks_refresh_until_reset_and_explains_403(
    monkeypatch,
) -> None:
    monkeypatch.setattr(github_api_rate_limit, "_latest_rate_limit", None)
    monkeypatch.setattr(github_api_rate_limit, "_latest_secondary_retry_at", None)
    headers = {
        "x-ratelimit-remaining": "10",
        "x-ratelimit-limit": "60",
        "x-ratelimit-reset": "1800000000",
    }
    github_api_rate_limit.record_github_api_rate_limit(headers)

    block_message = github_api_rate_limit.github_api_manual_refresh_block_message(
        now=datetime(2027, 1, 15, 7, 59, tzinfo=timezone.utc),
    )
    after_reset = github_api_rate_limit.github_api_manual_refresh_block_message(
        now=datetime(2027, 1, 15, 8, 1, tzinfo=timezone.utc),
    )
    exhausted_message = github_api_rate_limit.github_api_rate_limit_error_message(
        403,
        {**headers, "x-ratelimit-remaining": "0"},
    )

    assert block_message is not None and "수동 새로고침을 잠갔습니다" in block_message
    assert after_reset is None
    assert exhausted_message == (
        "GitHub API 요청 한도가 소진되었습니다. "
        "초기화 시각: 2027-01-15T08:00:00+00:00"
    )
    assert github_api_rate_limit.github_api_rate_limit_error_message(
        429,
        {**headers, "x-ratelimit-remaining": "0"},
    ) == exhausted_message
    assert github_api_rate_limit.github_api_rate_limit_error_message(500, headers) is None


def test_github_api_secondary_limit_uses_retry_after_and_separate_guidance(
    monkeypatch,
) -> None:
    monkeypatch.setattr(github_api_rate_limit, "_latest_rate_limit", None)
    monkeypatch.setattr(github_api_rate_limit, "_latest_secondary_retry_at", None)
    now = datetime(2027, 1, 15, 7, 0, tzinfo=timezone.utc)
    headers = {
        "x-ratelimit-remaining": "42",
        "x-ratelimit-limit": "60",
        "x-ratelimit-reset": "1800000000",
        "retry-after": "120",
    }

    message = github_api_rate_limit.github_api_rate_limit_error_message(
        403,
        headers,
        '{"message":"You have exceeded a secondary rate limit."}',
        now=now,
    )

    assert message == (
        "GitHub API 보조 요청 제한에 걸렸습니다. 짧은 시간 요청을 줄이고 "
        "재시도 시각 이후 다시 확인하세요: 2027-01-15T07:02:00+00:00"
    )
    assert github_api_rate_limit.read_github_api_rate_limit()["secondary_retry_at"] == (
        "2027-01-15T07:02:00+00:00"
    )
    assert "GitHub API 보조 제한" in (
        github_api_rate_limit.github_api_manual_refresh_block_message(now=now) or ""
    )
    assert github_api_rate_limit.github_api_manual_refresh_block_message(
        now=datetime(2027, 1, 15, 7, 3, tzinfo=timezone.utc),
    ) is None


def test_github_api_429_without_primary_exhaustion_waits_one_minute(monkeypatch) -> None:
    monkeypatch.setattr(github_api_rate_limit, "_latest_rate_limit", None)
    monkeypatch.setattr(github_api_rate_limit, "_latest_secondary_retry_at", None)
    now = datetime(2027, 1, 15, 7, 0, tzinfo=timezone.utc)

    message = github_api_rate_limit.github_api_rate_limit_error_message(
        429,
        {},
        now=now,
    )

    assert message is not None and "보조 요청 제한" in message
    assert github_api_rate_limit.read_github_api_rate_limit()["secondary_retry_at"] == (
        "2027-01-15T07:01:00+00:00"
    )
    assert github_api_rate_limit.github_api_rate_limit_error_message(403, {}) is None


@pytest.mark.asyncio
async def test_github_api_request_counter_tracks_nested_response_records() -> None:
    async def record_response() -> None:
        github_api_rate_limit.record_github_api_rate_limit({})

    with github_api_rate_limit.track_github_api_requests() as counter:
        await asyncio.gather(record_response(), record_response())

    assert counter == [2]
