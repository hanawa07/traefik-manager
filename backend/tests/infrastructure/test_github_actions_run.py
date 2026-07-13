from datetime import datetime

import pytest

from app.infrastructure import github_actions_run
from app.infrastructure.github_actions_run import (
    GitHubActionsRunStatusReader,
    build_actions_run_api_url,
)


def test_build_actions_run_api_url_accepts_only_github_run_url() -> None:
    assert build_actions_run_api_url(
        "https://github.com/hanawa07/traefik-manager/actions/runs/123"
    ) == "https://api.github.com/repos/hanawa07/traefik-manager/actions/runs/123"
    assert build_actions_run_api_url("https://example.com/actions/runs/123") is None
    assert build_actions_run_api_url("https://github.com/owner/repo/actions/runs/not-a-number") is None


@pytest.mark.asyncio
async def test_actions_run_reader_returns_final_conclusion(monkeypatch) -> None:
    GitHubActionsRunStatusReader._cache = {}
    captured: dict[str, object] = {"count": 0}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"status": "completed", "conclusion": "failure"}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured["kwargs"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str):
            captured["url"] = url
            captured["count"] = int(captured["count"]) + 1
            return FakeResponse()

    monkeypatch.setattr(github_actions_run.httpx, "AsyncClient", FakeAsyncClient)

    result = await GitHubActionsRunStatusReader().get_status(
        "https://github.com/hanawa07/traefik-manager/actions/runs/123"
    )
    cached_result = await GitHubActionsRunStatusReader().get_status(
        "https://github.com/hanawa07/traefik-manager/actions/runs/123"
    )

    assert captured["url"] == "https://api.github.com/repos/hanawa07/traefik-manager/actions/runs/123"
    assert result["external_watchdog_last_alert_run_status"] == "completed"
    assert result["external_watchdog_last_alert_run_conclusion"] == "failure"
    assert isinstance(result["external_watchdog_last_alert_run_checked_at"], datetime)
    assert result["external_watchdog_last_alert_run_error"] is None
    assert cached_result == result
    assert captured["count"] == 1


@pytest.mark.asyncio
async def test_actions_run_reader_skips_request_without_run_url(monkeypatch) -> None:
    def fail_client(**kwargs):
        raise AssertionError("HTTP request must not run")

    monkeypatch.setattr(github_actions_run.httpx, "AsyncClient", fail_client)

    result = await GitHubActionsRunStatusReader().get_status(None)

    assert result == {
        "external_watchdog_last_alert_run_status": None,
        "external_watchdog_last_alert_run_conclusion": None,
        "external_watchdog_last_alert_run_checked_at": None,
        "external_watchdog_last_alert_run_error": None,
    }
