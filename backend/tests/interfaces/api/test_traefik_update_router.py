from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.interfaces.api.v1.routers import traefik_updates
from app.interfaces.api.v1.schemas.traefik_schemas import TraefikUpdateRequest


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
