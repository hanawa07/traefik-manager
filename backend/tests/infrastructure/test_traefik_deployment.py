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
        "docker_api": "ok",
        "compose_metadata": "ok",
        "version_delta": "ok",
        "proxy_network": "ok",
        "acme_storage": "ok",
    }
    assert any("traefik:v3.7.6" in item["command"] for item in result["commands"])
    apply_command = next(
        item["command"] for item in result["commands"] if item["label"] == "업데이트 적용"
    )
    assert "run-traefik-recreate-safely.sh" in apply_command
    assert " up -d " not in apply_command
    status_command = next(item["command"] for item in result["commands"] if item["label"] == "상태 확인")
    assert (
        "docker compose -f /home/lizstudio/docker/traefik/docker-compose.yml "
        "exec -T traefik wget -qO- "
        "http://127.0.0.1:8080/api/version"
    ) in status_command
    assert "curl -fsS http://127.0.0.1:8080/api/version" not in status_command


@pytest.mark.asyncio
async def test_traefik_deployment_status_reports_missing_socket():
    docker_client = _DockerClient({})
    docker_client.enabled = False

    result = await TraefikDeploymentInspector(docker_client).get_status(latest_version="v3.7.6")

    assert result["enabled"] is False
    assert result["can_apply"] is False
    assert result["checks"][0]["status"] == "fail"


@pytest.mark.asyncio
async def test_traefik_deployment_status_reports_latest_version(monkeypatch):
    monkeypatch.setattr("app.infrastructure.docker.traefik_deployment.which", lambda name: None)
    docker_client = _DockerClient(
        {
            "Config": {
                "Image": "traefik:v3.7.6",
                "Labels": {
                    "com.docker.compose.project": "traefik",
                    "com.docker.compose.service": "traefik",
                    "com.docker.compose.project.working_dir": "/home/lizstudio/docker/traefik",
                    "com.docker.compose.project.config_files": "/home/lizstudio/docker/traefik/docker-compose.yml",
                    "org.opencontainers.image.version": "v3.7.6",
                },
            },
            "NetworkSettings": {"Networks": {"proxy_net": {}}},
            "Mounts": [{"Destination": "/letsencrypt"}],
        }
    )

    result = await TraefikDeploymentInspector(docker_client).get_status(latest_version="v3.7.6")

    checks = {check["key"]: check for check in result["checks"]}
    assert result["update_available"] is False
    assert result["current_image"] == "traefik:v3.7.6"
    assert result["target_image"] == "traefik:v3.7.6"
    assert checks["version_delta"]["status"] == "ok"
    assert "최신 버전" in checks["version_delta"]["message"]
    assert not any("sed -i" in item["command"] for item in result["commands"])


@pytest.mark.asyncio
async def test_traefik_deployment_commands_support_multiple_custom_compose_files(monkeypatch):
    monkeypatch.setattr("app.infrastructure.docker.traefik_deployment.which", lambda name: None)
    docker_client = _DockerClient(
        {
            "Config": {
                "Image": "traefik:v3.7.5",
                "Labels": {
                    "com.docker.compose.project": "edge",
                    "com.docker.compose.service": "edge-proxy",
                    "com.docker.compose.project.working_dir": "/srv/traefik stack",
                    "com.docker.compose.project.config_files": (
                        "/srv/traefik stack/compose.prod.yml, "
                        "/srv/traefik stack/compose.override.yml"
                    ),
                    "org.opencontainers.image.version": "v3.7.5",
                },
            },
            "NetworkSettings": {"Networks": {"proxy_net": {}}},
            "Mounts": [{"Destination": "/letsencrypt"}],
        }
    )

    result = await TraefikDeploymentInspector(docker_client).get_status(latest_version="v3.7.6")

    assert result["compose_config_files"] == [
        "/srv/traefik stack/compose.prod.yml",
        "/srv/traefik stack/compose.override.yml",
    ]
    commands = {item["label"]: item["command"] for item in result["commands"]}
    compose_command = (
        "docker compose -f '/srv/traefik stack/compose.prod.yml' "
        "-f '/srv/traefik stack/compose.override.yml'"
    )
    assert commands["업데이트 적용"] == (
        f"cd '/srv/traefik stack' && {compose_command} pull edge-proxy && "
        "TM_TRAEFIK_UPDATE_COMPOSE_DIR='/srv/traefik stack' "
        "TM_TRAEFIK_UPDATE_COMPOSE_FILES=compose.prod.yml,compose.override.yml "
        "TM_TRAEFIK_UPDATE_SERVICE=edge-proxy TM_TRAEFIK_UPDATE_CONTAINER=traefik "
        '"${HOME}/docker/traefik-manager/scripts/run-traefik-recreate-safely.sh"'
    )
    assert f"{compose_command} exec -T edge-proxy" in commands["상태 확인"]
    assert "cp -- '/srv/traefik stack/compose.prod.yml'" in commands["백업 생성"]
    assert "cp -- '/srv/traefik stack/compose.override.yml'" in commands["백업 생성"]
    assert "grep -Fq -- 'image: traefik:v3.7.5'" in commands["이미지 태그 변경"]
    assert commands["이미지 태그 변경"].count("'/srv/traefik stack/compose.") == 4


class _DockerClient:
    enabled = True

    def __init__(self, container):
        self.container = container

    async def get_container(self, container_name: str):
        assert container_name == "traefik"
        return self.container
