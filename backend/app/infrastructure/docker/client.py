import re
from pathlib import Path

import httpx

from app.core.config import settings


class DockerClientError(Exception):
    """Docker API 처리 실패 예외"""


class DockerClient:
    """Docker Socket 기반 읽기 전용 컨테이너 조회 클라이언트"""

    def __init__(self):
        self.socket_path = settings.DOCKER_SOCKET_PATH
        self.api_version = settings.DOCKER_API_VERSION.strip("/")
        self.timeout = settings.DOCKER_API_TIMEOUT_SECONDS

    @property
    def enabled(self) -> bool:
        return Path(self.socket_path).exists()

    async def list_container_candidates(self) -> dict:
        if not self.enabled:
            return {
                "enabled": False,
                "socket_path": self.socket_path,
                "message": "Docker 소켓이 없어 자동 감지가 비활성화되어 있습니다",
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

            candidates = self._extract_candidates(item, labels)
            containers.append(
                {
                    "id": item.get("Id"),
                    "name": self._get_container_name(item),
                    "image": item.get("Image"),
                    "state": item.get("State"),
                    "status": item.get("Status"),
                    "candidates": candidates,
                }
            )

        return {
            "enabled": True,
            "socket_path": self.socket_path,
            "message": "Docker 컨테이너 목록을 조회했습니다",
            "containers": containers,
        }

    async def _get_json(self, path: str, params: dict | None = None) -> list[dict]:
        transport = httpx.AsyncHTTPTransport(uds=self.socket_path)
        try:
            async with httpx.AsyncClient(
                base_url="http://docker",
                transport=transport,
                timeout=self.timeout,
            ) as client:
                response = await client.get(path, params=params)
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, list):
                    raise DockerClientError("Docker API 응답 형식이 올바르지 않습니다")
                return payload
        except (httpx.HTTPError, ValueError, OSError) as exc:
            raise DockerClientError("Docker 컨테이너 목록 조회에 실패했습니다") from exc

    def _extract_candidates(self, container: dict, labels: dict) -> list[dict]:
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
