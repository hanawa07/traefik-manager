from datetime import datetime, timedelta, timezone

import pytest

from app.infrastructure.smoke_run_history import (
    GitHubSmokeRunHistoryReader,
    read_smoke_history_cache_diagnostics,
)
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

    initial = await reader.get_history(source_url, **kwargs)
    refreshed = await reader.get_history(source_url, force_refresh=True, **kwargs)

    assert refreshed["error"] == "원격 오류"
    assert refreshed["statistics"] == statistics
    assert refreshed["data_checked_at"] == initial["checked_at"]


def test_history_response_cache_removes_expired_and_oldest_items(monkeypatch) -> None:
    now = datetime.now(timezone.utc)
    cache = {
        (f"https://api.github.com/repos/example/{index}", None, 1, "", "all", "all"): (
            now - timedelta(seconds=index),
            {},
        )
        for index in range(205)
    }
    expired_key = (
        "https://api.github.com/repos/example/expired",
        None,
        1,
        "",
        "all",
        "all",
    )
    cache[expired_key] = (now - timedelta(seconds=601), {})
    monkeypatch.setattr(GitHubSmokeRunHistoryReader, "_cache", cache)
    monkeypatch.setattr(GitHubSmokeRunHistoryReader, "_cache_hits", 3)
    monkeypatch.setattr(GitHubSmokeRunHistoryReader, "_cache_misses", 1)

    diagnostics = read_smoke_history_cache_diagnostics(now=now)

    assert len(cache) == 200
    assert expired_key not in cache
    assert not any(key[0].endswith("/204") for key in cache)
    assert any(key[0].endswith("/0") for key in cache)
    assert diagnostics == {
        "items": 200,
        "capacity": 200,
        "hits": 3,
        "misses": 1,
    }


@pytest.mark.asyncio
async def test_history_reader_force_refresh_bypasses_cache(monkeypatch) -> None:
    class CountingReader(GitHubSmokeRunHistoryReader):
        calls = 0

        async def _fetch_history(
            self,
            _api_url: str,
            _public_url: str,
            *,
            force_refresh: bool = False,
            recent_days: int | None = None,
            page: int = 1,
            search: str = "",
            status_filter: str = "all",
            cancellation_reason_filter: str = "all",
        ) -> dict:
            self.calls += 1
            return {
                "runs": [],
                "latest_failure": None,
                "statistics": [],
                "recent_days": recent_days,
                "page": page,
                "per_page": 5,
                "total": 0,
                "total_pages": 0,
                "search": search,
                "status_filter": status_filter,
                "cancellation_reason_filter": cancellation_reason_filter,
                "error": None,
            }

    monkeypatch.setattr(GitHubSmokeRunHistoryReader, "_cache", {})
    monkeypatch.setattr(GitHubSmokeRunHistoryReader, "_cache_hits", 0)
    monkeypatch.setattr(GitHubSmokeRunHistoryReader, "_cache_misses", 0)
    reader = CountingReader()
    source_url = "https://github.com/hanawa07/traefik-manager-force-refresh-test"

    first = await reader.get_history(source_url)
    await reader.get_history(source_url)
    await reader.get_history(source_url, force_refresh=True)

    assert reader.calls == 2
    assert first["checked_at"] is not None
    assert first["data_checked_at"] == first["checked_at"]
    assert read_smoke_history_cache_diagnostics()["hits"] == 1
    assert read_smoke_history_cache_diagnostics()["misses"] == 2


@pytest.mark.asyncio
async def test_history_reader_caches_each_day_range_separately() -> None:
    class CountingReader(GitHubSmokeRunHistoryReader):
        calls: list[tuple[int | None, int, str, str, str]] = []

        async def _fetch_history(
            self,
            _api_url: str,
            _public_url: str,
            *,
            force_refresh: bool = False,
            recent_days: int | None = None,
            page: int = 1,
            search: str = "",
            status_filter: str = "all",
            cancellation_reason_filter: str = "all",
        ) -> dict:
            self.calls.append(
                (recent_days, page, search, status_filter, cancellation_reason_filter)
            )
            return {
                "runs": [],
                "latest_failure": None,
                "statistics": [],
                "recent_days": recent_days,
                "page": page,
                "per_page": 5,
                "total": 0,
                "total_pages": 0,
                "search": search,
                "status_filter": status_filter,
                "cancellation_reason_filter": cancellation_reason_filter,
                "error": None,
            }

    reader = CountingReader()
    source_url = "https://github.com/hanawa07/traefik-manager-range-cache-test"

    await reader.get_history(source_url, recent_days=7)
    await reader.get_history(source_url, recent_days=30)
    await reader.get_history(source_url, recent_days=7)
    await reader.get_history(source_url, recent_days=7, page=2)
    await reader.get_history(source_url, recent_days=7, search="123")

    assert reader.calls == [
        (7, 1, "", "all", "all"),
        (30, 1, "", "all", "all"),
        (7, 2, "", "all", "all"),
        (7, 1, "123", "all", "all"),
    ]
