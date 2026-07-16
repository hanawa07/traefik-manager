import re
from datetime import datetime
from urllib.parse import quote

import httpx

from app.core.config import settings
from app.infrastructure.docker.api_client import build_docker_api_client, docker_api_available
from app.infrastructure.docker.deployment_release import ManagerReleaseChecker
from app.infrastructure.docker.manager_http_errors import MANAGER_HTTP_ERROR_WINDOW_HOURS
from app.infrastructure.docker.manager_http_log_reader import (
    read_manager_http_error_counts,
    read_manager_http_error_summary,
    read_manager_http_log_storage,
)


class DockerClientError(Exception):
    """Docker API 처리 실패 예외"""


class DockerClient:
    """최소 권한 Docker API 기반 컨테이너 조회 클라이언트"""

    OCI_LABEL_PREFIX = "org.opencontainers.image."

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

            labels = item.get("Labels") or {}
            if not isinstance(labels, dict):
                labels = {}

            ports = self._extract_ports(item)
            networks = self._extract_networks(item)
            traefik_candidates = self._extract_traefik_candidates(item, labels)
            containers.append(
                {
                    "id": item.get("Id"),
                    "name": self._get_container_name(item),
                    "image": item.get("Image"),
                    "state": item.get("State"),
                    "status": item.get("Status"),
                    "ports": ports,
                    "networks": networks,
                    "traefik_candidates": traefik_candidates,
                }
            )

        return {
            "enabled": True,
            "socket_path": self.read_api_url or self.socket_path,
            "message": "Docker 컨테이너 목록을 조회했습니다",
            "containers": containers,
        }

    async def get_manager_deployment_info(self, *, refresh_latest: bool = False) -> dict:
        fallback_component = self._build_fallback_component("backend")
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
        version = self._select_component_value(components, "version") or fallback_component["version"]
        source = self._select_component_value(components, "source") or fallback_component["source"]
        release_info = await ManagerReleaseChecker().get_release_status(
            version,
            source,
            force_refresh=refresh_latest,
        )
        return {
            "enabled": True,
            "message": f"배포 이미지 라벨을 조회했습니다 ({ok_count}/{len(components)}개)",
            "version": version,
            "revision": self._select_component_value(components, "revision") or fallback_component["revision"],
            "build_date": self._select_component_value(components, "build_date") or fallback_component["build_date"],
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
        current_networks = self._extract_networks(container)
        if network_name in current_networks:
            return {
                "changed": False,
                "container_id": self._normalize_value(container.get("Id")),
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
            "container_id": self._normalize_value(updated_container.get("Id")) or self._normalize_value(container.get("Id")),
            "networks": self._extract_networks(updated_container),
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
            return {
                "name": name,
                "container_name": container_name,
                "status": "unavailable",
                "runtime_status": None,
                "health_status": None,
                "health_failing_streak": 0,
                "health_last_checked_at": None,
                "health_last_exit_code": None,
                "container_id": None,
                "image": None,
                "image_id": None,
                "image_created": None,
                "version": None,
                "revision": None,
                "build_date": None,
                "source": None,
                "oci_labels": {},
            }

        config = container.get("Config") if isinstance(container.get("Config"), dict) else {}
        state = container.get("State") if isinstance(container.get("State"), dict) else {}
        health = state.get("Health") if isinstance(state.get("Health"), dict) else {}
        health_logs = health.get("Log") if isinstance(health.get("Log"), list) else []
        last_health_log = next(
            (item for item in reversed(health_logs) if isinstance(item, dict)),
            {},
        )
        image_ref = container.get("Image") or config.get("Image")
        image = await self._inspect_image(str(image_ref)) if image_ref else {}
        image_config = image.get("Config") if isinstance(image.get("Config"), dict) else {}
        labels = self._extract_oci_labels(image_config.get("Labels"))
        if not labels:
            labels = self._extract_oci_labels(config.get("Labels"))
        env_map = self._parse_env(config.get("Env"))

        return {
            "name": name,
            "container_name": container_name,
            "status": "ok",
            "runtime_status": self._normalize_value(state.get("Status")),
            "health_status": self._normalize_value(health.get("Status")),
            "health_failing_streak": health.get("FailingStreak")
            if isinstance(health.get("FailingStreak"), int)
            else 0,
            "health_last_checked_at": self._normalize_value(
                last_health_log.get("End") or last_health_log.get("Start")
            ),
            "health_last_exit_code": last_health_log.get("ExitCode")
            if isinstance(last_health_log.get("ExitCode"), int)
            else None,
            "container_id": self._normalize_value(container.get("Id")),
            "image": self._normalize_value(config.get("Image")),
            "image_id": self._normalize_value(image.get("Id")) or self._normalize_value(image_ref),
            "image_created": self._normalize_value(image.get("Created")),
            "version": self._normalize_value(
                labels.get("org.opencontainers.image.version") or env_map.get("TRAEFIK_MANAGER_VERSION")
            ),
            "revision": self._normalize_value(
                labels.get("org.opencontainers.image.revision") or env_map.get("TRAEFIK_MANAGER_GIT_SHA")
            ),
            "build_date": self._normalize_value(
                labels.get("org.opencontainers.image.created") or env_map.get("TRAEFIK_MANAGER_BUILD_DATE")
            ),
            "source": self._normalize_value(
                labels.get("org.opencontainers.image.source") or env_map.get("TRAEFIK_MANAGER_IMAGE_SOURCE")
            ),
            "oci_labels": labels,
        }

    async def _inspect_image(self, image_ref: str) -> dict:
        try:
            return await self._get_object_json(f"/{self.api_version}/images/{quote(image_ref, safe='')}/json")
        except DockerClientError:
            return {}

    def _build_fallback_component(self, name: str) -> dict:
        return {
            "name": name,
            "container_name": settings.TRAEFIK_MANAGER_BACKEND_CONTAINER_NAME,
            "status": "local_env",
            "runtime_status": None,
            "health_status": None,
            "health_failing_streak": 0,
            "health_last_checked_at": None,
            "health_last_exit_code": None,
            "container_id": None,
            "image": None,
            "image_id": None,
            "image_created": None,
            "version": self._normalize_value(settings.TRAEFIK_MANAGER_VERSION),
            "revision": self._normalize_value(settings.TRAEFIK_MANAGER_GIT_SHA),
            "build_date": self._normalize_value(settings.TRAEFIK_MANAGER_BUILD_DATE),
            "source": self._normalize_value(settings.TRAEFIK_MANAGER_IMAGE_SOURCE),
            "oci_labels": {},
        }

    def _extract_oci_labels(self, labels) -> dict[str, str]:
        if not isinstance(labels, dict):
            return {}
        return {
            str(key): str(value)
            for key, value in labels.items()
            if isinstance(key, str) and key.startswith(self.OCI_LABEL_PREFIX) and value is not None
        }

    def _parse_env(self, values) -> dict[str, str]:
        if not isinstance(values, list):
            return {}
        parsed: dict[str, str] = {}
        for item in values:
            if not isinstance(item, str) or "=" not in item:
                continue
            key, value = item.split("=", 1)
            parsed[key] = value
        return parsed

    def _select_component_value(self, components: list[dict], key: str) -> str | None:
        for component in components:
            value = self._normalize_value(component.get(key))
            if value:
                return value
        return None

    def _normalize_value(self, value) -> str | None:
        text = str(value).strip() if value is not None else ""
        if not text or text.lower() == "unknown":
            return None
        return text

    def _extract_traefik_candidates(self, container: dict, labels: dict) -> list[dict]:
        candidates: list[dict] = []
        router_rule_map: dict[str, str] = {}

        for key, value in labels.items():
            if not isinstance(key, str) or not isinstance(value, str):
                continue
            match = re.match(r"^traefik\.http\.routers\.([^.]+)\.rule$", key)
            if match:
                router_rule_map[match.group(1)] = value

        for router_name, rule in sorted(router_rule_map.items()):
            domains = self._extract_domains(rule)
            if not domains:
                continue

            entry_points = str(labels.get(f"traefik.http.routers.{router_name}.entrypoints", ""))
            tls_enabled = "websecure" in entry_points.lower()

            service_label_name = labels.get(f"traefik.http.routers.{router_name}.service", router_name)
            port_label_key = f"traefik.http.services.{service_label_name}.loadbalancer.server.port"
            port_label_fallback_key = f"traefik.http.services.{router_name}.loadbalancer.server.port"
            port_value = labels.get(port_label_key) or labels.get(port_label_fallback_key)
            upstream_port = self._parse_port(port_value) or self._detect_private_port(container)

            upstream_host = self._get_container_name(container)

            for domain in domains:
                candidates.append(
                    {
                        "router_name": router_name,
                        "domain": domain,
                        "upstream_host": upstream_host,
                        "upstream_port": upstream_port or 80,
                        "tls_enabled": tls_enabled,
                    }
                )

        return candidates

    def _extract_ports(self, container: dict) -> list[dict]:
        ports = container.get("Ports") or []
        if not isinstance(ports, list):
            return []

        extracted: list[dict] = []
        seen: set[tuple[int, int | None, str | None]] = set()

        for item in ports:
            if not isinstance(item, dict):
                continue

            private_port = item.get("PrivatePort")
            if not isinstance(private_port, int):
                continue

            public_port = item.get("PublicPort")
            if not isinstance(public_port, int):
                public_port = None

            port_type = item.get("Type")
            if not isinstance(port_type, str):
                port_type = None

            key = (private_port, public_port, port_type)
            if key in seen:
                continue
            seen.add(key)

            extracted.append(
                {
                    "private_port": private_port,
                    "public_port": public_port,
                    "type": port_type,
                }
            )

        return sorted(
            extracted,
            key=lambda item: (
                item["private_port"],
                item["public_port"] if item["public_port"] is not None else -1,
                item["type"] or "",
            ),
        )

    def _extract_networks(self, container: dict) -> list[str]:
        network_settings = container.get("NetworkSettings") or {}
        if not isinstance(network_settings, dict):
            return []

        networks = network_settings.get("Networks") or {}
        if not isinstance(networks, dict):
            return []

        extracted = [name for name in networks.keys() if isinstance(name, str) and name.strip()]
        return sorted(extracted)

    def _extract_domains(self, rule: str) -> list[str]:
        domains: set[str] = set()
        for match in re.findall(r"Host\(([^)]+)\)", rule):
            for token in match.split(","):
                value = token.strip().strip("`").strip('"').strip("'")
                if value:
                    domains.add(value)
        return sorted(domains)

    def _parse_port(self, value) -> int | None:
        try:
            port = int(str(value))
            return port if 1 <= port <= 65535 else None
        except (TypeError, ValueError):
            return None

    def _detect_private_port(self, container: dict) -> int | None:
        ports = container.get("Ports") or []
        if not isinstance(ports, list):
            return None
        for item in ports:
            if not isinstance(item, dict):
                continue
            private_port = item.get("PrivatePort")
            if isinstance(private_port, int):
                return private_port
        return None

    def _get_container_name(self, container: dict) -> str:
        names = container.get("Names") or []
        if isinstance(names, list) and names:
            first = str(names[0]).strip()
            return first[1:] if first.startswith("/") else first
        return str(container.get("Id", ""))[:12]
