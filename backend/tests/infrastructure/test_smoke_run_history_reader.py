import httpx
import pytest

from app.infrastructure import github_api_rate_limit, smoke_run_history_fetcher
from app.infrastructure.smoke_run_history import GitHubSmokeRunHistoryReader


@pytest.mark.asyncio
async def test_history_reader_rejects_non_github_source_without_request() -> None:
    history = await GitHubSmokeRunHistoryReader().get_history("https://example.com/repository")

    assert history == {
        "runs": [],
        "latest_failure": None,
        "statistics": [],
        "checked_at": None,
        "recent_days": None,
        "page": 1,
        "per_page": 5,
        "total": 0,
        "total_pages": 0,
        "search": "",
        "status_filter": "all",
        "cancellation_reason_filter": "all",
        "github_api_request_usage": None,
        "error": "GitHub 저장소 주소를 확인하지 못했습니다",
    }


@pytest.mark.asyncio
async def test_history_reader_explains_github_rate_limit_reset(monkeypatch) -> None:
    monkeypatch.setattr(github_api_rate_limit, "_latest_rate_limit", None)

    async def fail_with_rate_limit(*_args, **_kwargs):
        request = httpx.Request("GET", "https://api.github.com/example")
        response = httpx.Response(
            403,
            headers={
                "x-ratelimit-remaining": "0",
                "x-ratelimit-limit": "60",
                "x-ratelimit-reset": "1800000000",
            },
            request=request,
        )
        raise httpx.HTTPStatusError("rate limited", request=request, response=response)

    monkeypatch.setattr(
        smoke_run_history_fetcher,
        "read_smoke_workflow_runs",
        fail_with_rate_limit,
    )

    history = await GitHubSmokeRunHistoryReader()._fetch_history(
        "https://api.github.com/repos/example/repository",
        "https://github.com/example/repository",
    )

    assert history["error"] == (
        "GitHub API 요청 한도가 소진되었습니다. "
        "초기화 시각: 2027-01-15T08:00:00+00:00"
    )


@pytest.mark.asyncio
async def test_history_reader_counts_github_requests_for_next_refresh_estimate(
    monkeypatch,
) -> None:
    async def fake_runs(*_args, **_kwargs):
        github_api_rate_limit.record_github_api_rate_limit({}, category="workflow")
        github_api_rate_limit.record_github_api_rate_limit({}, category="workflow")
        return [
            {
                "id": 123,
                "status": "completed",
                "conclusion": "success",
                "updated_at": "2026-07-11T07:31:58Z",
                "head_sha": "89327cb0a0d3c3435449b7c1284136fad350ccde",
                "run_number": 77,
            }
        ]

    monkeypatch.setattr(smoke_run_history_fetcher, "read_smoke_workflow_runs", fake_runs)

    history = await GitHubSmokeRunHistoryReader()._fetch_history(
        "https://api.github.com/repos/example/request-count-test",
        "https://github.com/example/request-count-test",
    )

    assert history["github_api_request_usage"] == {
        "total": 2,
        "workflow": 2,
        "job": 0,
        "artifact": 0,
    }
