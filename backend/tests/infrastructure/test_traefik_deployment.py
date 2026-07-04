import pytest

from app.infrastructure.docker.traefik_deployment import TraefikDeploymentInspector


@pytest.mark.asyncio
async def test_traefik_deployment_status_builds_compose_update_commands(monkeypatch):
    monkeypatch.setattr("app.infrastructure.docker.traefik_deployment.which", lambda name: None)
    docker_client = _DockerClient(
        {
            "Config": {
                "Image": "traefik:v3.7.5",
                "Labels": {
                    "com.docker.compose.project": "traefik",
                    "com.docker.compose.service": "traefik",
                    "com.docker.compose.project.working_dir": "/home/lizstudio/docker/traefik",
                    "com.docker.compose.project.config_files": "/home/lizstudio/docker/traefik/docker-compose.yml",
                    "org.opencontainers.image.version": "v3.7.5",
                },
            },
            "NetworkSettings": {"Networks": {"proxy_net": {}}},
            "Mounts": [{"Destination": "/letsencrypt"}],
        }
    )

    result = await TraefikDeploymentInspector(docker_client).get_status(latest_version="v3.7.6")

    assert result["current_image"] == "traefik:v3.7.5"
    assert result["target_image"] == "traefik:v3.7.6"
    assert result["update_available"] is True
    assert result["compose_working_dir"] == "/home/lizstudio/docker/traefik"
    assert result["can_apply"] is False
    assert "Docker CLI" in result["apply_blocked_reason"]
    assert {check["key"]: check["status"] for check in result["checks"]} == {
        "docker_socket": "ok",
        "compose_metadata": "ok",
        "version_delta": "ok",
        "proxy_network": "ok",
        "acme_storage": "ok",
    }
    assert any("traefik:v3.7.6" in item["command"] for item in result["commands"])


@pytest.mark.asyncio
async def test_traefik_deployment_status_reports_missing_socket():
    docker_client = _DockerClient({})
    docker_client.enabled = False

    result = await TraefikDeploymentInspector(docker_client).get_status(latest_version="v3.7.6")

    assert result["enabled"] is False
    assert result["can_apply"] is False
    assert result["checks"][0]["status"] == "fail"


class _DockerClient:
    enabled = True
    api_version = "v1.41"

    def __init__(self, container):
        self.container = container

    async def _get_object_json(self, path: str, params=None):
        assert path == "/v1.41/containers/traefik/json"
        return self.container
