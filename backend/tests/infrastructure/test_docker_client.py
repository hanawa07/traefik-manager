import pytest

from app.infrastructure.docker import manager_deployment_inspector, manager_http_log_reader
from app.infrastructure.docker.client import DockerClient, DockerClientError


@pytest.mark.asyncio
async def test_list_container_candidates_includes_general_and_traefik_metadata(monkeypatch):
    client = DockerClient()
    client._transport.socket_path = "/etc/hosts"

    async def fake_get_list(_path: str, params=None):
        assert params == {"all": 0}
        return [
            {
                "Id": "container-1",
                "Names": ["/english"],
                "Image": "ghcr.io/example/english:latest",
                "State": "running",
                "Status": "Up 2 hours",
                "Labels": {
                    "com.docker.compose.project": "english",
                    "com.docker.compose.service": "app",
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

    monkeypatch.setattr(client._transport, "get_list", fake_get_list)

    payload = await client.list_container_candidates()

    assert payload["enabled"] is True
    assert payload["message"] == "Docker 컨테이너 목록을 조회했습니다"
    assert len(payload["containers"]) == 1

    container = payload["containers"][0]
    assert container["name"] == "english"
    assert container["compose_project"] == "english"
    assert container["compose_service"] == "app"
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
    client._transport.socket_path = "/etc/hosts"
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

    async def fake_get_object(_path: str, params=None):
        return inspected.pop(0)

    async def fake_post(path: str, payload: dict):
        posts.append((path, payload))

    monkeypatch.setattr(client._transport, "get_object", fake_get_object)
    monkeypatch.setattr(client._transport, "post", fake_post)

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
async def test_connect_container_to_network_requires_read_and_mutation_paths():
    client = DockerClient()
    client._transport.socket_path = "/missing"
    client._transport.read_api_url = None
    client._transport.mutation_api_url = "http://dockerproxy:2376"

    with pytest.raises(DockerClientError, match="조회 또는 변경 API 경로"):
        await client.connect_container_to_network(
            container_name="english-app-1",
            network_name="proxy_net",
        )


@pytest.mark.asyncio
async def test_inspect_manager_component_includes_runtime_health(monkeypatch):
    client = DockerClient()

    async def fake_get_object(_path: str, params=None):
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

    async def fake_inspect_image(_transport, _image_ref: str):
        return {"Id": "sha256:image-1", "Config": {"Labels": {}}}

    monkeypatch.setattr(client._transport, "get_object", fake_get_object)
    monkeypatch.setattr(manager_deployment_inspector, "_inspect_image", fake_inspect_image)

    component = await manager_deployment_inspector._inspect_component(
        client._transport,
        name="backend",
        container_name="traefik-manager-backend",
    )

    assert component["runtime_status"] == "running"
    assert component["health_status"] == "unhealthy"
    assert component["health_failing_streak"] == 3
    assert component["health_last_checked_at"] == "2026-07-12T17:48:33Z"
    assert component["health_last_exit_code"] == 1
    assert "Output" not in component


@pytest.mark.asyncio
async def test_manager_http_error_summary_reads_backend_container_logs(monkeypatch):
    client = DockerClient()
    client._transport.socket_path = "/etc/hosts"
    captured = []
    monkeypatch.setattr(
        manager_http_log_reader,
        "_manager_traefik_access_log_reader",
        manager_http_log_reader.ManagerTraefikAccessLogReader(),
    )

    async def fake_read_logs(**kwargs):
        captured.append(kwargs)
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

    calls_by_container = {item["container_name"]: item for item in captured}
    assert calls_by_container["traefik-manager-backend"]["tail_lines"] == 5000
    assert calls_by_container["traefik"]["tail_lines"] == 2000
    assert isinstance(calls_by_container["traefik-manager-backend"]["since"], int)
    assert calls_by_container["traefik"]["since"] == (
        calls_by_container["traefik-manager-backend"]["since"]
    )
    assert summary["available"] is True
    assert summary["not_found_count"] == 0
    assert summary["client_cancellation"]["available"] is True
    assert summary["log_storage"]["source"] == "docker"


@pytest.mark.asyncio
async def test_manager_http_error_summary_prefers_persistent_request_logs(monkeypatch):
    client = DockerClient()
    client._transport.socket_path = "/etc/hosts"
    monkeypatch.setattr(
        manager_http_log_reader,
        "_manager_traefik_access_log_reader",
        manager_http_log_reader.ManagerTraefikAccessLogReader(),
    )
    monkeypatch.setattr(
        manager_http_log_reader,
        "read_manager_http_request_logs",
        lambda _path: "",
    )

    captured = []

    async def fake_traefik_logs(**kwargs):
        captured.append(kwargs)
        assert kwargs["container_name"] == "traefik"
        return ""

    monkeypatch.setattr(
        manager_http_log_reader,
        "read_docker_container_logs_text",
        fake_traefik_logs,
    )

    summary = await client.get_manager_http_error_summary()

    assert summary["available"] is True
    assert summary["not_found_count"] == 0
    assert summary["client_cancellation"]["available"] is True
    assert summary["log_storage"]["source"] == "persistent"
    assert len(captured) == 1


@pytest.mark.asyncio
async def test_manager_http_log_storage_uses_lightweight_source_check(monkeypatch):
    client = DockerClient()
    client._transport.socket_path = "/etc/hosts"
    monkeypatch.setattr(
        manager_http_log_reader,
        "manager_http_request_logs_available",
        lambda _path: False,
    )
    captured = {}

    async def fake_read_logs(**kwargs):
        captured.update(kwargs)
        return ""

    monkeypatch.setattr(
        manager_http_log_reader,
        "read_docker_container_logs_text",
        fake_read_logs,
    )

    storage = await client.get_manager_http_log_storage()

    assert storage["source"] == "docker"
    assert captured["tail_lines"] == 1
    assert "since" not in captured
