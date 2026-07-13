from datetime import datetime, timezone

import pytest

from app.interfaces.api.v1.routers import docker


@pytest.mark.asyncio
async def test_manager_http_errors_forwards_period_and_path_filter() -> None:
    class FakeDockerClient:
        async def get_manager_http_error_summary(self, **kwargs):
            return kwargs

    result = await docker.get_manager_http_errors(
        window_hours=6,
        path="/api/v1/services",
        docker_client=FakeDockerClient(),
        _={},
    )

    assert result == {
        "window_hours": 6,
        "path_filter": "/api/v1/services",
    }


@pytest.mark.asyncio
async def test_deployment_info_enriches_each_watchdog_run(monkeypatch) -> None:
    run_urls = [
        "https://github.com/hanawa07/traefik-manager/actions/runs/123",
        "https://github.com/hanawa07/traefik-manager/actions/runs/456",
    ]
    requested_at = datetime(2026, 7, 13, tzinfo=timezone.utc)

    class FakeDockerClient:
        async def get_manager_deployment_info(self, *, refresh_latest: bool):
            return {"enabled": True, "message": "정상"}

    class FakeRunStatusReader:
        async def get_statuses(self, urls: list[str]):
            assert urls == run_urls
            return {
                url: {
                    "external_watchdog_last_alert_run_status": "completed",
                    "external_watchdog_last_alert_run_conclusion": conclusion,
                    "external_watchdog_last_alert_run_checked_at": requested_at,
                    "external_watchdog_last_alert_run_error": None,
                }
                for url, conclusion in zip(urls, ["success", "failure"])
            }

        async def get_status(self, run_url: str | None):
            raise AssertionError("최근 실행은 이력 조회 결과를 재사용해야 합니다")

    async def read_stale_minutes(_repository):
        return 10

    monkeypatch.setattr(docker, "read_external_watchdog_stale_minutes", read_stale_minutes)
    monkeypatch.setattr(
        docker,
        "read_manager_watchdog_state",
        lambda **_: {
            "external_watchdog_last_alert_run_url": run_urls[0],
            "external_watchdog_alert_runs": [
                {"event": "recovery", "requested_at": requested_at, "run_url": run_urls[0]},
                {"event": "failure", "requested_at": requested_at, "run_url": run_urls[1]},
            ],
        },
    )
    monkeypatch.setattr(docker, "GitHubActionsRunStatusReader", FakeRunStatusReader)

    result = await docker.get_deployment_info(
        docker_client=FakeDockerClient(),
        db=object(),
        refresh_latest=False,
        _={},
    )

    assert result["external_watchdog_last_alert_run_conclusion"] == "success"
    assert [run["conclusion"] for run in result["external_watchdog_alert_runs"]] == [
        "success",
        "failure",
    ]
