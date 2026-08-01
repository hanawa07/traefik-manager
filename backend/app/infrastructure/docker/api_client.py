from pathlib import Path

import httpx


class DockerClientError(Exception):
    """Docker API 처리 실패 예외"""


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


class DockerApiTransport:
    """Docker read/mutation API 요청과 응답 경계를 담당한다."""

    def __init__(
        self,
        *,
        socket_path: str,
        read_api_url: str | None,
        mutation_api_url: str | None,
        api_version: str,
        timeout: float,
    ):
        self.socket_path = socket_path
        self.read_api_url = read_api_url
        self.mutation_api_url = mutation_api_url
        self.api_version = api_version.strip("/")
        self.timeout = timeout

    @property
    def read_enabled(self) -> bool:
        return docker_api_available(api_url=self.read_api_url, socket_path=self.socket_path)

    @property
    def mutation_enabled(self) -> bool:
        return docker_api_available(api_url=self.mutation_api_url, socket_path=self.socket_path)

    @property
    def location(self) -> str:
        return self.read_api_url or self.socket_path

    async def get_list(self, path: str, params: dict | None = None) -> list[dict]:
        payload = await self._request_json(path, params=params)
        if not isinstance(payload, list):
            raise DockerClientError("Docker API 응답 형식이 올바르지 않습니다")
        return payload

    async def get_object(self, path: str, params: dict | None = None) -> dict:
        payload = await self._request_json(path, params=params)
        if not isinstance(payload, dict):
            raise DockerClientError("Docker API 응답 형식이 올바르지 않습니다")
        return payload

    async def post(self, path: str, payload: dict) -> None:
        try:
            async with build_docker_api_client(
                api_url=self.mutation_api_url,
                socket_path=self.socket_path,
                timeout=self.timeout,
            ) as client:
                response = await client.post(path, json=payload)
                response.raise_for_status()
        except (httpx.HTTPError, OSError) as exc:
            raise DockerClientError("Docker API 변경 요청에 실패했습니다") from exc

    async def _request_json(self, path: str, params: dict | None = None):
        try:
            async with build_docker_api_client(
                api_url=self.read_api_url,
                socket_path=self.socket_path,
                timeout=self.timeout,
            ) as client:
                response = await client.get(path, params=params)
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError, OSError) as exc:
            raise DockerClientError("Docker API 조회에 실패했습니다") from exc
