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
