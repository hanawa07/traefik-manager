from datetime import datetime
from urllib.parse import quote

import httpx

from app.core.config import settings
from app.infrastructure.docker.api_client import build_docker_api_client, docker_api_available
from app.infrastructure.docker.container_candidate_parser import (
    build_container_candidate,
    extract_networks,
)
from app.infrastructure.docker.deployment_release import ManagerReleaseChecker
from app.infrastructure.docker.manager_http_errors import MANAGER_HTTP_ERROR_WINDOW_HOURS
from app.infrastructure.docker.manager_http_log_reader import (
    read_manager_http_error_counts,
    read_manager_http_error_summary,
    read_manager_http_log_storage,
)
from app.infrastructure.docker.manager_component_inspector import (
    build_fallback_component,
    build_manager_component,
    build_unavailable_component,
    get_manager_component_image_ref,
    normalize_value,
    select_component_value,
)


class DockerClientError(Exception):
    """Docker API 처리 실패 예외"""


class DockerClient:
    """최소 권한 Docker API 기반 컨테이너 조회 클라이언트"""

    def __init__(self):
        self.socket_path = settings.DOCKER_SOCKET_PATH
        self.read_api_url = settings.DOCKER_READ_API_URL
        self.mutation_api_url = settings.DOCKER_MUTATION_API_URL
        self.api_version = settings.DOCKER_API_VERSION.strip("/")
        self.timeout = settings.DOCKER_API_TIMEOUT_SECONDS

    @property
    def enabled(self) -> bool:
        return docker_api_available(api_url=self.read_api_url, socket_path=self.socket_path)

    async def list_container_candidates(self) -> dict:
        if not self.enabled:
            return {
                "enabled": False,
                "socket_path": self.read_api_url or self.socket_path,
                "message": "Docker API 연결 경로가 없어 자동 감지가 비활성화되어 있습니다",
                "containers": [],
            }

        containers_payload = await self._get_json(f"/{self.api_version}/containers/json", params={"all": 0})
        containers: list[dict] = []

        for item in containers_payload:
            if not isinstance(item, dict):
                continue
            containers.append(build_container_candidate(item))

        return {
            "enabled": True,
            "socket_path": self.read_api_url or self.socket_path,
            "message": "Docker 컨테이너 목록을 조회했습니다",
            "containers": containers,
        }

    async def get_manager_deployment_info(self, *, refresh_latest: bool = False) -> dict:
        fallback_component = build_fallback_component("backend")
        if not self.enabled:
            version = fallback_component["version"]
            source = fallback_component["source"]
            release_info = await ManagerReleaseChecker().get_release_status(
                version,
                source,
                force_refresh=refresh_latest,
            )
            return {
                "enabled": False,
                "message": "Docker API 연결 경로가 없어 배포 이미지 라벨을 조회할 수 없습니다",
                "version": version,
                "revision": fallback_component["revision"],
                "build_date": fallback_component["build_date"],
                "source": source,
                **release_info,
                "http_error_summary": await self.get_manager_http_error_summary(),
                "components": [fallback_component],
            }

        components = await self.inspect_manager_components()
        http_error_summary = await self.get_manager_http_error_summary()
        ok_count = sum(1 for item in components if item["status"] == "ok")
        version = select_component_value(components, "version") or fallback_component["version"]
        source = select_component_value(components, "source") or fallback_component["source"]
        release_info = await ManagerReleaseChecker().get_release_status(
            version,
            source,
            force_refresh=refresh_latest,
        )
        return {
            "enabled": True,
            "message": f"배포 이미지 라벨을 조회했습니다 ({ok_count}/{len(components)}개)",
            "version": version,
            "revision": select_component_value(components, "revision") or fallback_component["revision"],
            "build_date": select_component_value(components, "build_date") or fallback_component["build_date"],
            "source": source,
            **release_info,
            "http_error_summary": http_error_summary,
            "components": components,
        }

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

    async def inspect_manager_components(self) -> list[dict]:
        if not self.enabled:
            return []
        return [
            await self._inspect_manager_component(
                name="backend",
                container_name=settings.TRAEFIK_MANAGER_BACKEND_CONTAINER_NAME,
            ),
            await self._inspect_manager_component(
                name="frontend",
                container_name=settings.TRAEFIK_MANAGER_FRONTEND_CONTAINER_NAME,
            ),
        ]

    async def connect_container_to_network(self, *, container_name: str, network_name: str) -> dict:
        mutation_enabled = docker_api_available(api_url=self.mutation_api_url, socket_path=self.socket_path)
        if not self.enabled or not mutation_enabled:
            raise DockerClientError("Docker 조회 또는 변경 API 경로가 없어 네트워크 연결을 실행할 수 없습니다")

        container = await self._get_object_json(f"/{self.api_version}/containers/{quote(container_name, safe='')}/json")
        current_networks = extract_networks(container)
        if network_name in current_networks:
            return {
                "changed": False,
                "container_id": normalize_value(container.get("Id")),
                "networks": current_networks,
            }

        await self._post_json(
            f"/{self.api_version}/networks/{quote(network_name, safe='')}/connect",
            {"Container": container_name},
        )
        updated_container = await self._get_object_json(
            f"/{self.api_version}/containers/{quote(container_name, safe='')}/json"
        )
        return {
            "changed": True,
            "container_id": normalize_value(updated_container.get("Id")) or normalize_value(container.get("Id")),
            "networks": extract_networks(updated_container),
        }

    async def _get_json(self, path: str, params: dict | None = None) -> list[dict]:
        payload = await self._request_json(path, params=params)
        if not isinstance(payload, list):
            raise DockerClientError("Docker API 응답 형식이 올바르지 않습니다")
        return payload

    async def _get_object_json(self, path: str, params: dict | None = None) -> dict:
        payload = await self._request_json(path, params=params)
        if not isinstance(payload, dict):
            raise DockerClientError("Docker API 응답 형식이 올바르지 않습니다")
        return payload

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

    async def _post_json(self, path: str, payload: dict) -> None:
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

    async def _inspect_manager_component(self, name: str, container_name: str) -> dict:
        try:
            container = await self._get_object_json(
                f"/{self.api_version}/containers/{quote(container_name, safe='')}/json"
            )
        except DockerClientError:
            return build_unavailable_component(name=name, container_name=container_name)

        image_ref = get_manager_component_image_ref(container)
        image = await self._inspect_image(image_ref) if image_ref else {}
        return build_manager_component(
            name=name,
            container_name=container_name,
            container=container,
            image=image,
        )

    async def _inspect_image(self, image_ref: str) -> dict:
        try:
            return await self._get_object_json(f"/{self.api_version}/images/{quote(image_ref, safe='')}/json")
        except DockerClientError:
            return {}
