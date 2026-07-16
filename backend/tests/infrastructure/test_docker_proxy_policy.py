from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SOCKET_MOUNT = "/var/run/docker.sock:/var/run/docker.sock:ro"


def test_docker_socket_is_mounted_only_by_internal_proxy():
    compose = yaml.safe_load((PROJECT_ROOT / "docker-compose.yml").read_text(encoding="utf-8"))
    services = compose["services"]
    backend_services = [name for name in services if name == "backend" or name.startswith("backend-")]

    assert SOCKET_MOUNT in services["dockerproxy"]["volumes"]
    assert services["dockerproxy"]["networks"] == ["traefik-manager-internal"]
    assert compose["networks"]["traefik-manager-internal"]["internal"] is True
    for service_name in backend_services:
        assert SOCKET_MOUNT not in services[service_name].get("volumes", [])


def test_docker_proxy_policy_separates_reads_from_network_connects():
    config = (PROJECT_ROOT / "deploy/docker-proxy/haproxy.cfg").read_text(encoding="utf-8")

    assert "frontend docker_read\n    bind :2375" in config
    assert "acl read_method method GET\n" in config
    assert "frontend docker_network_connect\n    bind :2376" in config
    assert "acl connect_method method POST" in config
    assert "networks/proxy_net/connect$" in config
