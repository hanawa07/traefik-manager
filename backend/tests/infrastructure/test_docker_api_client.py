from app.infrastructure.docker.api_client import build_docker_api_client, docker_api_available


def test_docker_api_url_enables_client_without_local_socket():
    assert docker_api_available(api_url="http://dockerproxy:2375", socket_path="/missing") is True
    assert docker_api_available(api_url=None, socket_path="/missing") is False


def test_docker_api_client_uses_configured_proxy_url():
    client = build_docker_api_client(
        api_url="http://dockerproxy:2376/",
        socket_path="/missing",
        timeout=5,
    )

    assert str(client.base_url) == "http://dockerproxy:2376"
