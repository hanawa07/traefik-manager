from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

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
async def test_manager_http_errors_accepts_integer_query_value() -> None:
    captured: dict[str, object] = {}

    class FakeDockerClient:
        async def get_manager_http_error_summary(self, **kwargs):
            captured.update(kwargs)
            return {
                "available": True,
                "message": "집계 완료",
                "window_hours": kwargs["window_hours"],
                "path_filter": kwargs["path_filter"],
                "checked_at": datetime(2026, 7, 14, tzinfo=timezone.utc),
                "observed_since": None,
                "sample_coverage_percent": 0,
                "not_found_count": 0,
                "server_error_count": 0,
                "buckets": [],
                "top_paths": [],
            }

    app = FastAPI()
    app.include_router(docker.router)
    app.dependency_overrides[docker.get_current_user] = lambda: {"username": "admin"}
    app.dependency_overrides[docker.get_docker_client] = FakeDockerClient
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            "/http-errors",
            params={"window_hours": "6", "path": "services"},
        )

    assert response.status_code == 200
    assert captured == {"window_hours": 6, "path_filter": "services"}


@pytest.mark.asyncio
async def test_manager_http_errors_rejects_unsupported_period() -> None:
    app = FastAPI()
    app.include_router(docker.router)
    app.dependency_overrides[docker.get_current_user] = lambda: {"username": "admin"}
    app.dependency_overrides[docker.get_docker_client] = lambda: object()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/http-errors", params={"window_hours": "7"})

    assert response.status_code == 422
    assert response.json()["detail"] == "조회 기간은 6, 12, 24시간만 선택할 수 있습니다"


@pytest.mark.asyncio
async def test_manager_http_error_preview_normalizes_and_forwards_inputs(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def read_preview(**kwargs):
        captured.update(kwargs)
        return {
            "available": True,
            "message": "계산 완료",
            "window_hours": 24,
            "window_minutes": kwargs["window_minutes"],
            "checked_at": datetime(2026, 7, 14, tzinfo=timezone.utc),
            "observed_since": None,
            "sample_coverage_percent": 0,
            "peak_not_found_count": 2,
            "peak_server_error_count": 1,
            "recommended_not_found_threshold": 20,
            "recommended_server_error_threshold": 2,
            "excluded_paths": [
                {
                    "path": kwargs["excluded_paths"][0],
                    "not_found_count": 1,
                    "server_error_count": 0,
                }
            ],
        }

    class FakeDockerClient:
        enabled = True

    monkeypatch.setattr(docker, "read_manager_http_error_preview", read_preview)
    app = FastAPI()
    app.include_router(docker.router)
    app.dependency_overrides[docker.get_current_user] = lambda: {"username": "admin"}
    app.dependency_overrides[docker.get_docker_client] = FakeDockerClient
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/http-errors/preview",
            json={
                "window_minutes": 30,
                "excluded_paths": [" /api/v1/health/ "],
            },
        )

    assert response.status_code == 200
    assert captured == {
        "docker_enabled": True,
        "window_minutes": 30,
        "excluded_paths": ("/api/v1/health",),
    }
    assert response.json()["recommended_server_error_threshold"] == 2


@pytest.mark.asyncio
async def test_manager_http_error_preview_rejects_non_api_exclusion() -> None:
    app = FastAPI()
    app.include_router(docker.router)
    app.dependency_overrides[docker.get_current_user] = lambda: {"username": "admin"}
    app.dependency_overrides[docker.get_docker_client] = lambda: object()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/http-errors/preview",
            json={"window_minutes": 15, "excluded_paths": ["/dashboard"]},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_deployment_info_enriches_watchdog_and_recent_deployment_runs(monkeypatch) -> None:
    watchdog_run_urls = [
        "https://github.com/hanawa07/traefik-manager/actions/runs/123",
        "https://github.com/hanawa07/traefik-manager/actions/runs/456",
    ]
    deployment_run_urls = [
        f"https://github.com/hanawa07/traefik-manager/actions/runs/{run_id}"
        for run_id in range(789, 795)
    ]
    bottleneck_run_url = "https://github.com/hanawa07/traefik-manager/actions/runs/999"
    requested_run_urls = [*watchdog_run_urls, *deployment_run_urls[:5], bottleneck_run_url]
    requested_at = datetime(2026, 7, 13, tzinfo=timezone.utc)

    class FakeDockerClient:
        async def get_manager_deployment_info(self, *, refresh_latest: bool):
            return {"enabled": True, "message": "정상"}

    class FakeRunStatusReader:
        async def get_statuses(self, urls: list[str]):
            assert urls == requested_run_urls
            return {
                url: {
                    "external_watchdog_last_alert_run_status": "completed",
                    "external_watchdog_last_alert_run_conclusion": (
                        "failure" if url == watchdog_run_urls[1] else "success"
                    ),
                    "external_watchdog_last_alert_run_checked_at": requested_at,
                    "external_watchdog_last_alert_run_error": None,
                }
                for url in urls
            }

        async def get_status(self, run_url: str | None):
            raise AssertionError("최근 실행은 이력 조회 결과를 재사용해야 합니다")

    async def read_stale_minutes(_repository):
        return 10

    async def read_http_monitor(_repository):
        return {"enabled": False, "available": False}

    class FakeTraefikClient:
        async def get_manager_route_status(self):
            return {"available": True, "healthy": True, "provider": "file"}

    monkeypatch.setattr(docker, "read_external_watchdog_stale_minutes", read_stale_minutes)
    monkeypatch.setattr(docker, "read_manager_http_error_monitor_status", read_http_monitor)
    monkeypatch.setattr(
        docker,
        "read_manager_watchdog_state",
        lambda **_: {
            "external_watchdog_last_alert_run_url": watchdog_run_urls[0],
            "external_watchdog_alert_runs": [
                {
                    "event": "recovery",
                    "requested_at": requested_at,
                    "run_url": watchdog_run_urls[0],
                },
                {
                    "event": "failure",
                    "requested_at": requested_at,
                    "run_url": watchdog_run_urls[1],
                },
            ],
        },
    )
    monkeypatch.setattr(docker, "GitHubActionsRunStatusReader", FakeRunStatusReader)
    monkeypatch.setattr(
        docker,
        "read_manager_deployment_bottleneck_state",
        lambda: {
            "status": "alerted",
            "configured_threshold_ms": 60_000,
            "configured_consecutive_count": 3,
            "effective_threshold_ms": 60_000,
            "effective_consecutive_count": 3,
            "current_consecutive_count": 3,
            "run_url": bottleneck_run_url,
        },
    )
    monkeypatch.setattr(
        docker,
        "read_manager_deployment_history",
        lambda: [
            {
                "status": "rollback_failed",
                "alert_request_status": "requested",
                "alert_run_url": run_url,
            }
            for run_url in deployment_run_urls
        ],
    )
    monkeypatch.setattr(
        docker,
        "read_manager_deployment_history_archive_with_summary",
        lambda: (
            [{"status": "success", "alert_run_url": None}],
            {
                "detailed_count": 1,
                "daily_count": 0,
                "newest_at": requested_at,
                "oldest_at": requested_at,
            },
        ),
    )

    result = await docker.get_deployment_info(
        docker_client=FakeDockerClient(),
        traefik_client=FakeTraefikClient(),
        db=object(),
        refresh_latest=False,
        _={},
    )

    assert result["external_watchdog_last_alert_run_conclusion"] == "success"
    assert result["http_error_monitor"] == {"enabled": False, "available": False}
    assert result["manager_route"] == {
        "available": True,
        "healthy": True,
        "provider": "file",
    }
    assert result["deployment_history"][0]["alert_run_status"] == "completed"
    assert result["deployment_history"][0]["alert_run_conclusion"] == "success"
    assert result["deployment_history"][0]["alert_run_checked_at"] == requested_at
    assert result["deployment_history"][-1]["alert_run_status"] is None
    assert result["deployment_history_archive"][0]["alert_run_status"] is None
    assert result["deployment_history_archive_summary"]["detailed_count"] == 1
    assert result["deployment_bottleneck_alert"]["run_status"] == "completed"
    assert result["deployment_bottleneck_alert"]["run_conclusion"] == "success"
    assert [run["conclusion"] for run in result["external_watchdog_alert_runs"]] == [
        "success",
        "failure",
    ]
