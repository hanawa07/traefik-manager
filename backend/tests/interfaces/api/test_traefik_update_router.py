from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.interfaces.api.v1.routers import traefik_updates
from app.interfaces.api.v1.schemas.traefik_schemas import TraefikUpdateRequest


@pytest.mark.asyncio
async def test_retry_traefik_rollback_alert_queues_failed_request(monkeypatch):
    source_request_id = "11111111-1111-4111-8111-111111111111"
    queued = {
        "request_id": "22222222-2222-4222-8222-222222222222",
        "target_version": "v3.7.9",
        "status": "queued",
        "requested_at": "2026-07-20T01:00:00Z",
        "message": "queued",
    }
    monkeypatch.setattr(
        traefik_updates,
        "read_traefik_update_operations",
        lambda: {
            "runner": {"available": True, "message": "ready"},
            "pending_request": False,
            "history": [
                {
                    "request_id": source_request_id,
                    "status": "rollback_failed",
                    "target_version": "v3.7.9",
                    "alert_request_status": "request_failed",
                }
            ],
        },
    )
    queue_retry = Mock(return_value=queued)
    monkeypatch.setattr(traefik_updates, "queue_traefik_alert_retry", queue_retry)
    record_audit = AsyncMock()
    monkeypatch.setattr(traefik_updates.audit_service, "record", record_audit)

    result = await traefik_updates.retry_traefik_rollback_alert(
        request_id=source_request_id,
        request=Request(
            {
                "type": "http",
                "method": "POST",
                "path": f"/api/v1/traefik/update-operations/{source_request_id}/alert-retry",
                "headers": [],
                "client": ("127.0.0.1", 1234),
            }
        ),
        db=object(),
        actor={"username": "lizstudio"},
    )

    assert result == queued
    assert queue_retry.call_args.kwargs["source_request_id"] == source_request_id
    assert record_audit.await_args.kwargs["detail"]["event"] == (
        "traefik_rollback_alert_retry_requested"
    )
    assert record_audit.await_args.kwargs["resource_id"] == queued["request_id"]
    assert record_audit.await_args.kwargs["detail"]["source_request_id"] == source_request_id


@pytest.mark.asyncio
async def test_retry_traefik_rollback_alert_rejects_completed_alert(monkeypatch):
    source_request_id = "11111111-1111-4111-8111-111111111111"
    monkeypatch.setattr(
        traefik_updates,
        "read_traefik_update_operations",
        lambda: {
            "runner": {"available": True, "message": "ready"},
            "pending_request": False,
            "history": [
                {
                    "request_id": source_request_id,
                    "status": "rollback_failed",
                    "target_version": "v3.7.9",
                    "alert_request_status": "requested",
                }
            ],
        },
    )

    with pytest.raises(HTTPException) as exc_info:
        await traefik_updates.retry_traefik_rollback_alert(
            request_id=source_request_id,
            request=object(),
            db=object(),
            actor={"username": "lizstudio"},
        )

    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_get_traefik_update_operations_adds_alert_run_result(monkeypatch):
    run_url = "https://github.com/hanawa07/traefik-manager/actions/runs/123"
    operations = {
        "runner": {"available": True, "message": "ready"},
        "pending_request": False,
        "history": [{"request_id": "fixture", "alert_run_url": run_url}],
    }
    monkeypatch.setattr(
        traefik_updates,
        "read_traefik_update_operations",
        lambda: operations,
    )

    class FakeRunStatusReader:
        async def get_statuses(self, run_urls):
            assert run_urls == [run_url]
            return {
                run_url: {
                    "external_watchdog_last_alert_run_status": "completed",
                    "external_watchdog_last_alert_run_conclusion": "success",
                    "external_watchdog_last_alert_run_checked_at": None,
                    "external_watchdog_last_alert_run_error": None,
                }
            }

    monkeypatch.setattr(
        traefik_updates,
        "GitHubActionsRunStatusReader",
        FakeRunStatusReader,
    )

    result = await traefik_updates.get_traefik_update_operations(_={})

    assert result["history"][0]["alert_run_status"] == "completed"
    assert result["history"][0]["alert_run_conclusion"] == "success"


@pytest.mark.asyncio
async def test_request_traefik_patch_update_queues_verified_latest_patch(monkeypatch):
    queued = {
        "request_id": "11111111-1111-4111-8111-111111111111",
        "target_version": "v3.7.9",
        "status": "queued",
        "requested_at": "2026-07-20T01:00:00Z",
        "message": "queued",
    }
    monkeypatch.setattr(
        traefik_updates,
        "read_traefik_update_operations",
        lambda: {
            "runner": {"available": True, "message": "ready"},
            "pending_request": False,
            "history": [],
        },
    )
    monkeypatch.setattr(
        traefik_updates,
        "queue_traefik_patch_update",
        lambda **kwargs: queued,
    )
    record_audit = AsyncMock()
    monkeypatch.setattr(traefik_updates.audit_service, "record", record_audit)

    result = await traefik_updates.request_traefik_patch_update(
        payload=TraefikUpdateRequest(target_version="3.7.9"),
        request=Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/v1/traefik/update-requests",
                "headers": [],
                "client": ("127.0.0.1", 1234),
            }
        ),
        db=object(),
        actor={"username": "lizstudio"},
        traefik_client=_TraefikClient(),
        docker_client=_DockerClient(),
    )

    assert result == queued
    assert record_audit.await_args.kwargs["detail"]["event"] == "traefik_patch_update_requested"
    assert record_audit.await_args.kwargs["detail"]["target_version"] == "v3.7.9"


def test_validate_safe_patch_request_rejects_minor_update():
    with pytest.raises(HTTPException) as exc_info:
        traefik_updates._validate_safe_patch_request(
            {
                "enabled": True,
                "current_version": "v3.7.8",
                "target_version": "v3.8.0",
                "update_available": True,
                "checks": [],
            },
            "v3.8.0",
        )

    assert exc_info.value.status_code == 422
    assert "패치 업데이트만" in exc_info.value.detail


class _TraefikClient:
    async def get_health(self, *, refresh_latest=False):
        assert refresh_latest is True
        return {"latest_version": "v3.7.9"}


class _DockerClient:
    enabled = True
    api_version = "v1.41"

    async def _get_object_json(self, path: str, params=None):
        assert path == "/v1.41/containers/traefik/json"
        return {
            "Config": {
                "Image": "traefik:v3.7.8",
                "Labels": {
                    "com.docker.compose.project": "traefik",
                    "com.docker.compose.service": "traefik",
                    "com.docker.compose.project.working_dir": "/home/lizstudio/docker/traefik",
                    "com.docker.compose.project.config_files": "/home/lizstudio/docker/traefik/docker-compose.yml",
                    "org.opencontainers.image.version": "v3.7.8",
                },
            },
            "NetworkSettings": {"Networks": {"proxy_net": {}}},
            "Mounts": [{"Destination": "/letsencrypt"}],
        }
