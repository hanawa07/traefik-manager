import pytest

from app.infrastructure.docker import manager_http_log_reader
from app.infrastructure.docker.client import DockerClient


@pytest.mark.asyncio
async def test_list_container_candidates_includes_general_and_traefik_metadata(monkeypatch):
    client = DockerClient()
    client.socket_path = "/etc/hosts"

    async def fake_get_json(_path: str, params=None):
        assert params == {"all": 0}
        return [
            {
                "Id": "container-1",
                "Names": ["/english"],
                "Image": "ghcr.io/example/english:latest",
                "State": "running",
                "Status": "Up 2 hours",
                "Labels": {
                    "traefik.enable": "true",
                    "traefik.http.routers.english.rule": "Host(`english.example.com`,`www.english.example.com`)",
                    "traefik.http.routers.english.entrypoints": "websecure",
                    "traefik.http.services.english.loadbalancer.server.port": "3000",
                },
                "Ports": [
                    {"PrivatePort": 3000, "PublicPort": 3000, "Type": "tcp"},
                    {"PrivatePort": 9229, "Type": "tcp"},
                ],
                "NetworkSettings": {
                    "Networks": {
                        "proxy_net": {},
                        "english_internal": {},
                    }
                },
            }
        ]

    monkeypatch.setattr(client, "_get_json", fake_get_json)

    payload = await client.list_container_candidates()

    assert payload["enabled"] is True
    assert payload["message"] == "Docker 컨테이너 목록을 조회했습니다"
    assert len(payload["containers"]) == 1

    container = payload["containers"][0]
    assert container["name"] == "english"
    assert container["ports"] == [
        {"private_port": 3000, "public_port": 3000, "type": "tcp"},
        {"private_port": 9229, "public_port": None, "type": "tcp"},
    ]
    assert container["networks"] == ["english_internal", "proxy_net"]
    assert container["traefik_candidates"] == [
        {
            "router_name": "english",
            "domain": "english.example.com",
            "upstream_host": "english",
            "upstream_port": 3000,
            "tls_enabled": True,
        },
        {
            "router_name": "english",
            "domain": "www.english.example.com",
            "upstream_host": "english",
            "upstream_port": 3000,
            "tls_enabled": True,
        },
    ]


@pytest.mark.asyncio
async def test_connect_container_to_network_posts_docker_network_connect(monkeypatch):
    client = DockerClient()
    client.socket_path = "/etc/hosts"
    inspected = [
        {
            "Id": "container-1",
            "NetworkSettings": {"Networks": {"default": {}}},
        },
        {
            "Id": "container-1",
            "NetworkSettings": {"Networks": {"default": {}, "proxy_net": {}}},
        },
    ]
    posts = []

    async def fake_get_object_json(_path: str, params=None):
        return inspected.pop(0)

    async def fake_post_json(path: str, payload: dict):
        posts.append((path, payload))

    monkeypatch.setattr(client, "_get_object_json", fake_get_object_json)
    monkeypatch.setattr(client, "_post_json", fake_post_json)

    result = await client.connect_container_to_network(container_name="english-app-1", network_name="proxy_net")

    assert result == {
        "changed": True,
        "container_id": "container-1",
        "networks": ["default", "proxy_net"],
    }
    assert posts == [
        (
            "/v1.41/networks/proxy_net/connect",
            {"Container": "english-app-1"},
        )
    ]


@pytest.mark.asyncio
async def test_inspect_manager_component_includes_runtime_health(monkeypatch):
    client = DockerClient()

    async def fake_get_object_json(_path: str, params=None):
        return {
            "Id": "container-1",
            "Image": "sha256:image-1",
            "Config": {"Image": "traefik-manager-backend"},
            "State": {
                "Status": "running",
                "Health": {
                    "Status": "unhealthy",
                    "FailingStreak": 3,
                    "Log": [
                        {
                            "Start": "2026-07-12T17:48:32Z",
                            "End": "2026-07-12T17:48:33Z",
                            "ExitCode": 1,
                            "Output": "민감할 수 있는 원문",
                        }
                    ],
                },
            },
        }

    async def fake_inspect_image(_image_ref: str):
        return {"Id": "sha256:image-1", "Config": {"Labels": {}}}

    monkeypatch.setattr(client, "_get_object_json", fake_get_object_json)
    monkeypatch.setattr(client, "_inspect_image", fake_inspect_image)

    component = await client._inspect_manager_component("backend", "traefik-manager-backend")

    assert component["runtime_status"] == "running"
    assert component["health_status"] == "unhealthy"
    assert component["health_failing_streak"] == 3
    assert component["health_last_checked_at"] == "2026-07-12T17:48:33Z"
    assert component["health_last_exit_code"] == 1
    assert "Output" not in component


@pytest.mark.asyncio
async def test_manager_http_error_summary_reads_backend_container_logs(monkeypatch):
    client = DockerClient()
    client.socket_path = "/etc/hosts"
    captured = {}

    async def fake_read_logs(**kwargs):
        captured.update(kwargs)
        return ""

    monkeypatch.setattr(
        manager_http_log_reader,
        "read_manager_http_request_logs",
        lambda _path: None,
    )
    monkeypatch.setattr(
        manager_http_log_reader,
        "read_docker_container_logs_text",
        fake_read_logs,
    )

    summary = await client.get_manager_http_error_summary()

    assert captured["container_name"] == "traefik-manager-backend"
    assert captured["tail_lines"] == 5000
    assert isinstance(captured["since"], int)
    assert summary["available"] is True
    assert summary["not_found_count"] == 0


@pytest.mark.asyncio
async def test_manager_http_error_summary_prefers_persistent_request_logs(monkeypatch):
    client = DockerClient()
    client.socket_path = "/etc/hosts"
    monkeypatch.setattr(
        manager_http_log_reader,
        "read_manager_http_request_logs",
        lambda _path: "",
    )

    async def unexpected_docker_logs(**_kwargs):
        raise AssertionError("영속 로그가 있으면 Docker 로그를 읽지 않아야 합니다")

    monkeypatch.setattr(
        manager_http_log_reader,
        "read_docker_container_logs_text",
        unexpected_docker_logs,
    )

    summary = await client.get_manager_http_error_summary()

    assert summary["available"] is True
    assert summary["not_found_count"] == 0
