import pytest

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
