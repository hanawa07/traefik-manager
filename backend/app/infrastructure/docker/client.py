from datetime import datetime

from app.core.config import settings
from app.infrastructure.docker.api_client import DockerApiTransport, DockerClientError
from app.infrastructure.docker.container_discovery import (
    get_container,
    list_container_candidates,
)
from app.infrastructure.docker.container_network import connect_container_to_network
from app.infrastructure.docker.manager_deployment_inspector import (
    get_manager_deployment_info,
    inspect_manager_components,
)
from app.infrastructure.docker.manager_http_errors import MANAGER_HTTP_ERROR_WINDOW_HOURS
from app.infrastructure.docker.manager_http_log_reader import (
    read_manager_http_error_counts,
    read_manager_http_error_summary,
    read_manager_http_log_storage,
)


class DockerClient:
    """어플리케이션이 사용하는 Docker 인프라 경계"""

    def __init__(self):
        self._transport = DockerApiTransport(
            socket_path=settings.DOCKER_SOCKET_PATH,
            read_api_url=settings.DOCKER_READ_API_URL,
            mutation_api_url=settings.DOCKER_MUTATION_API_URL,
            api_version=settings.DOCKER_API_VERSION,
            timeout=settings.DOCKER_API_TIMEOUT_SECONDS,
        )
    @property
    def enabled(self) -> bool:
        return self._transport.read_enabled

    async def list_container_candidates(self) -> dict:
        return await list_container_candidates(self._transport)

    async def get_container(self, container_name: str) -> dict:
        return await get_container(self._transport, container_name)

    async def connect_container_to_network(self, *, container_name: str, network_name: str) -> dict:
        return await connect_container_to_network(
            self._transport,
            container_name=container_name,
            network_name=network_name,
        )

    async def get_manager_deployment_info(self, *, refresh_latest: bool = False) -> dict:
        deployment_info = await get_manager_deployment_info(
            self._transport,
            refresh_latest=refresh_latest,
        )
        return {
            **deployment_info,
            "http_error_summary": await self.get_manager_http_error_summary(),
        }

    async def inspect_manager_components(self) -> list[dict]:
        return await inspect_manager_components(self._transport)

    async def get_manager_http_error_summary(
        self,
        *,
        window_hours: int = MANAGER_HTTP_ERROR_WINDOW_HOURS,
        path_filter: str | None = None,
    ) -> dict[str, object]:
        return await read_manager_http_error_summary(
            docker_enabled=self.enabled,
            window_hours=window_hours,
            path_filter=path_filter,
        )

    async def get_manager_http_error_counts(
        self,
        *,
        window_minutes: int,
        checked_at: datetime | None = None,
        excluded_paths: tuple[str, ...] = (),
    ) -> dict[str, object]:
        return await read_manager_http_error_counts(
            docker_enabled=self.enabled,
            checked_at=checked_at,
            window_minutes=window_minutes,
            excluded_paths=excluded_paths,
        )

    async def get_manager_http_log_storage(self) -> dict[str, object]:
        return await read_manager_http_log_storage(docker_enabled=self.enabled)


__all__ = ["DockerClient", "DockerClientError"]
