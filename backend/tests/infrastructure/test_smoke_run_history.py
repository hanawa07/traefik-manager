from datetime import datetime, timezone

import httpx
import pytest

from app.infrastructure import github_api_rate_limit, smoke_run_history
from app.infrastructure.smoke_run_history import (
    GitHubSmokeRunHistoryReader,
    build_smoke_run_item,
    paginate_smoke_runs,
    select_smoke_run_groups,
)
from app.infrastructure.smoke_run_details import build_smoke_artifacts


def _run(**overrides):
    return {
        "id": 123,
        "status": "completed",
        "conclusion": "success",
        "updated_at": "2026-07-11T07:31:58Z",
        "head_sha": "89327cb0a0d3c3435449b7c1284136fad350ccde",
        "run_number": 77,
        **overrides,
    }


def test_build_smoke_run_item_reports_failure_step_and_suppression() -> None:
    result = build_smoke_run_item(
        _run(conclusion="failure"),
        [
            {"name": "운영 로그인·화면 검사", "conclusion": "failure"},
            {"name": "반복 실패 알림 cooldown 확인", "conclusion": "success"},
            {"name": "Telegram 실패 알림", "conclusion": "skipped"},
        ],
        public_url="https://github.com/hanawa07/traefik-manager",
        artifact={
            "url": "https://github.com/example/artifact",
            "expires_at": "2026-07-18T06:54:58Z",
        },
    )

    assert result["status"] == "failure"
    assert result["run_id"] == 123
    assert result["summary"] == "실패 단계: 운영 로그인·화면 검사"
    assert result["notification_suppressed"] is True
    assert result["run_url"].endswith("/actions/runs/123")
    assert result["artifact_url"].endswith("/artifact")
    assert result["artifact_expires_at"] == "2026-07-18T06:54:58Z"


def test_build_smoke_artifacts_accepts_only_active_matching_artifact() -> None:
    artifacts = build_smoke_artifacts(
        [
            {
                "id": 1,
                "name": "other",
                "expired": False,
                "workflow_run": {"id": 123},
            },
            {
                "id": 2,
                "name": "dashboard-visual-smoke-123",
                "expired": True,
                "workflow_run": {"id": 123},
            },
            {
                "id": 3,
                "name": "dashboard-visual-smoke-123",
                "expired": False,
                "expires_at": "2026-07-18T06:54:58Z",
                "workflow_run": {"id": 123},
            },
        ],
        run_ids={123},
        public_url="https://github.com/hanawa07/traefik-manager",
    )

    assert artifacts == {
        123: {
            "url": "https://github.com/hanawa07/traefik-manager/actions/runs/123/artifacts/3",
            "expires_at": "2026-07-18T06:54:58Z",
        }
    }


def test_build_smoke_run_item_distinguishes_skipped_schedule() -> None:
    result = build_smoke_run_item(
        _run(),
        [{"name": "운영 로그인·화면 검사", "conclusion": "skipped"}],
        public_url="https://github.com/hanawa07/traefik-manager",
    )

    assert result["status"] == "skipped"
    assert result["summary"] == "예약 설정에 따라 점검을 건너뜀"
    assert result["notification_suppressed"] is False


def test_select_smoke_run_groups_keeps_latest_failure_outside_recent_five() -> None:
    runs = [
        _run(id=run_id, run_number=run_id, conclusion="success")
        for run_id in range(10, 4, -1)
    ]
    runs.append(_run(id=4, run_number=4, conclusion="failure"))

    recent, latest_failure = select_smoke_run_groups(runs)

    assert [run["id"] for run in recent] == [10, 9, 8, 7, 6]
    assert latest_failure["id"] == 4


def test_select_smoke_run_groups_excludes_test_runs_from_default_history() -> None:
    runs = [
        _run(id=12, conclusion="failure", display_title="[테스트] 실패 알림"),
        _run(id=11),
        _run(id=10, conclusion="failure"),
    ]

    recent, latest_failure = select_smoke_run_groups(runs)

    assert [run["id"] for run in recent] == [11, 10]
    assert latest_failure["id"] == 10


def test_select_smoke_run_groups_filters_requested_day_range() -> None:
    runs = [
        _run(id=10, updated_at="2026-07-17T00:00:00Z"),
        _run(id=9, updated_at="2026-07-11T00:00:00Z", conclusion="failure"),
        _run(id=8, updated_at="2026-06-17T00:00:00Z", conclusion="failure"),
        _run(id=7, updated_at="invalid"),
        _run(id=6, updated_at="2026-07-16T00:00:00Z", display_title="[테스트] 알림"),
    ]

    recent, latest_failure = select_smoke_run_groups(
        runs,
        recent_days=7,
        now=datetime(2026, 7, 18, tzinfo=timezone.utc),
    )

    assert [run["id"] for run in recent] == [10, 9]
    assert latest_failure["id"] == 9


def test_select_smoke_run_groups_filters_search_and_status_before_paging() -> None:
    runs = [
        _run(id=12, run_number=900, head_sha="abc1234", conclusion="failure"),
        _run(id=11, run_number=901, head_sha="def5678", conclusion="success"),
        _run(id=10, run_number=902, head_sha="abc9999", conclusion="success"),
    ]

    filtered, latest_failure = select_smoke_run_groups(
        runs,
        recent_days=30,
        now=datetime(2026, 7, 18, tzinfo=timezone.utc),
        search="ABC",
        status_filter="failure",
    )

    assert [run["id"] for run in filtered] == [12]
    assert latest_failure["id"] == 12


def test_paginate_smoke_runs_returns_requested_five_item_page() -> None:
    runs = [_run(id=run_id) for run_id in range(12, 0, -1)]

    page, total, total_pages = paginate_smoke_runs(runs, page=2)

    assert [run["id"] for run in page] == [7, 6, 5, 4, 3]
    assert total == 12
    assert total_pages == 3


@pytest.mark.asyncio
async def test_history_reader_rejects_non_github_source_without_request() -> None:
    history = await GitHubSmokeRunHistoryReader().get_history("https://example.com/repository")

    assert history == {
        "runs": [],
        "latest_failure": None,
        "checked_at": None,
        "recent_days": None,
        "page": 1,
        "per_page": 5,
        "total": 0,
        "total_pages": 0,
        "search": "",
        "status_filter": "all",
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
        smoke_run_history,
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
async def test_history_reader_force_refresh_bypasses_cache() -> None:
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
        ) -> dict:
            self.calls += 1
            return {
                "runs": [],
                "latest_failure": None,
                "recent_days": recent_days,
                "page": page,
                "per_page": 5,
                "total": 0,
                "total_pages": 0,
                "search": search,
                "status_filter": status_filter,
                "error": None,
            }

    reader = CountingReader()
    source_url = "https://github.com/hanawa07/traefik-manager-force-refresh-test"

    first = await reader.get_history(source_url)
    await reader.get_history(source_url)
    await reader.get_history(source_url, force_refresh=True)

    assert reader.calls == 2
    assert first["checked_at"] is not None


@pytest.mark.asyncio
async def test_history_reader_caches_each_day_range_separately() -> None:
    class CountingReader(GitHubSmokeRunHistoryReader):
        calls: list[tuple[int | None, int, str, str]] = []

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
        ) -> dict:
            self.calls.append((recent_days, page, search, status_filter))
            return {
                "runs": [],
                "latest_failure": None,
                "recent_days": recent_days,
                "page": page,
                "per_page": 5,
                "total": 0,
                "total_pages": 0,
                "search": search,
                "status_filter": status_filter,
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
        (7, 1, "", "all"),
        (30, 1, "", "all"),
        (7, 2, "", "all"),
        (7, 1, "123", "all"),
    ]
