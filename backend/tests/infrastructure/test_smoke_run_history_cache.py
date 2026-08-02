import pytest

from app.infrastructure.smoke_run_history import GitHubSmokeRunHistoryReader
from app.infrastructure.smoke_run_history_fetcher import build_smoke_history_error


@pytest.mark.asyncio
async def test_history_error_keeps_cached_statistics_when_filtered_runs_are_empty(
    monkeypatch,
) -> None:
    statistics = [{"window_days": 7, "total_count": 3}]

    class Reader(GitHubSmokeRunHistoryReader):
        calls = 0

        async def _fetch_history(self, *_args, **kwargs):
            self.calls += 1
            if self.calls > 1:
                return build_smoke_history_error(
                    "원격 오류",
                    recent_days=kwargs["recent_days"],
                )
            return {
                "runs": [],
                "latest_failure": None,
                "statistics": statistics,
                "recent_days": kwargs["recent_days"],
                "page": 1,
                "per_page": 5,
                "total": 0,
                "total_pages": 0,
                "search": "",
                "status_filter": "cancelled",
                "cancellation_reason_filter": "timeout",
                "github_api_request_usage": None,
                "error": None,
            }

    monkeypatch.setattr(GitHubSmokeRunHistoryReader, "_cache", {})
    reader = Reader()
    source_url = "https://github.com/example/statistics-cache-test"
    kwargs = {
        "recent_days": 30,
        "status_filter": "cancelled",
        "cancellation_reason_filter": "timeout",
    }

    await reader.get_history(source_url, **kwargs)
    refreshed = await reader.get_history(source_url, force_refresh=True, **kwargs)

    assert refreshed["error"] == "원격 오류"
    assert refreshed["statistics"] == statistics
