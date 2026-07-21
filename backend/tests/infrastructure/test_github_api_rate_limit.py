from datetime import datetime, timezone

from app.infrastructure import github_api_rate_limit


def test_github_api_rate_limit_keeps_lowest_remaining_for_same_window(monkeypatch) -> None:
    monkeypatch.setattr(github_api_rate_limit, "_latest_rate_limit", None)
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
    }


def test_github_api_rate_limit_blocks_refresh_until_reset_and_explains_403(
    monkeypatch,
) -> None:
    monkeypatch.setattr(github_api_rate_limit, "_latest_rate_limit", None)
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
    assert github_api_rate_limit.github_api_rate_limit_error_message(500, headers) is None
