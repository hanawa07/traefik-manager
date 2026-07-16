from pathlib import Path

import httpx


def docker_api_available(*, api_url: str | None, socket_path: str) -> bool:
    return bool((api_url or "").strip()) or Path(socket_path).exists()


def build_docker_api_client(
    *,
    api_url: str | None,
    socket_path: str,
    timeout: float,
) -> httpx.AsyncClient:
    normalized_url = (api_url or "").strip().rstrip("/")
    if normalized_url:
        return httpx.AsyncClient(base_url=normalized_url, timeout=timeout)

    return httpx.AsyncClient(
        base_url="http://docker",
        transport=httpx.AsyncHTTPTransport(uds=socket_path),
        timeout=timeout,
    )
