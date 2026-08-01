import asyncio
from datetime import datetime

import httpx

from app.core.config import settings
from app.infrastructure.traefik.acme_parsers import (
    extract_acme_certificate_expiry,
    parse_acme_expiry_map,
    parse_recent_acme_failures,
)
from app.infrastructure.traefik.certificate_preflight import (
    inspect_presented_certificate,
    probe_http_challenge_path,
    resolve_public_dns_records,
)
from app.infrastructure.traefik.certificate_listing_builder import build_certificate_listing
from app.infrastructure.traefik.certificate_preflight_runner import build_certificate_preflight_result
from app.infrastructure.traefik.docker_api import (
    read_docker_acme_json_text,
    read_docker_container_logs_text,
    read_local_acme_json_text,
)
from app.infrastructure.traefik.runtime_status_builder import (
    build_manager_route_status,
    build_middlewares_status,
    build_router_status,
)
from app.infrastructure.traefik.traefik_release_checker import TraefikReleaseChecker
from app.infrastructure.traefik.runtime_parsers import (
    compare_versions,
    extract_current_version,
)


class TraefikApiClientError(Exception):
    """Traefik API 호출 실패 예외"""


class TraefikApiClient:
    """Traefik REST API 클라이언트"""

    def __init__(self):
        self.base_url = settings.TRAEFIK_API_URL.rstrip("/")
        self.timeout = settings.TRAEFIK_API_TIMEOUT_SECONDS
        self.release_checker = TraefikReleaseChecker()

    async def get_health(self, *, refresh_latest: bool = False) -> dict:
        overview, version_payload, latest_info = await asyncio.gather(
            self._get_overview_or_none(),
            self._get_version_or_none(),
            self.release_checker.get_latest_version_info(force_refresh=refresh_latest),
        )

        if overview is None:
            return {
                "connected": False,
                "message": "Traefik에 연결할 수 없습니다",
                "version": None,
                **latest_info,
            }

        version = extract_current_version(overview) or extract_current_version(version_payload)
        version_comparison = compare_versions(version, latest_info.get("latest_version"))
        update_available = version_comparison < 0 if version_comparison is not None else None
        return {
            "connected": True,
            "message": "Traefik 연결됨",
            "version": version,
            **latest_info,
            "update_available": update_available,
        }

    async def _get_overview_or_none(self) -> dict | None:
        try:
            overview = await self._get("/api/overview")
        except TraefikApiClientError:
            return None
        return overview if isinstance(overview, dict) else None

    async def _get_version_or_none(self) -> dict | None:
        try:
            payload = await self._get("/api/version")
        except TraefikApiClientError:
            return None
        return payload if isinstance(payload, dict) else None

    async def get_router_status(self) -> dict:
        try:
            payload = await self._get("/api/http/routers")
        except TraefikApiClientError:
            return {
                "connected": False,
                "message": "Traefik 라우터 정보를 가져오지 못했습니다",
                "domains": {},
            }

        return build_router_status(payload)

    async def get_manager_route_status(self) -> dict[str, object]:
        try:
            routers, services = await asyncio.gather(
                self._get("/api/http/routers"),
                self._get("/api/http/services"),
            )
        except TraefikApiClientError:
            return build_manager_route_status(None, None)

        return build_manager_route_status(routers, services)

    async def list_middlewares(self) -> dict:
        try:
            payload = await self._get("/api/http/middlewares")
        except TraefikApiClientError:
            return {
                "connected": False,
                "message": "Traefik 미들웨어 정보를 가져오지 못했습니다",
                "middlewares": [],
            }

        return build_middlewares_status(payload)

    async def _load_acme_expiry_map(self) -> dict[str, datetime]:
        """acme.json에서 도메인별 만료일 파싱 (file 라우터 fallback용)"""
        local_text = read_local_acme_json_text()
        if local_text:
            expiry_map = parse_acme_expiry_map(local_text, extract_acme_certificate_expiry)
            if expiry_map:
                return expiry_map

        docker_text = await read_docker_acme_json_text()
        if docker_text:
            expiry_map = parse_acme_expiry_map(docker_text, extract_acme_certificate_expiry)
            if expiry_map:
                return expiry_map

        return {}

    async def _load_recent_acme_failures(self) -> dict[str, dict]:
        log_text = await read_docker_container_logs_text()
        if not log_text:
            return {}
        return parse_recent_acme_failures(log_text)

    async def list_certificates(self) -> list[dict]:
        overview, routers_payload = await asyncio.gather(
            self._get("/api/overview"),
            self._get("/api/http/routers"),
        )

        recent_acme_failures = await self._load_recent_acme_failures()
        acme_map = await self._load_acme_expiry_map()
        return build_certificate_listing(
            overview=overview,
            routers_payload=routers_payload,
            recent_acme_failures=recent_acme_failures,
            acme_expiry_map=acme_map,
        )

    async def get_certificate_preflight(self, domain: str, certificates: list[dict] | None = None) -> dict:
        certificates = certificates or await self.list_certificates()

        dns_result, http_result, https_result = await asyncio.gather(
            resolve_public_dns_records(domain),
            probe_http_challenge_path(domain),
            inspect_presented_certificate(domain),
        )
        return build_certificate_preflight_result(
            domain=domain,
            certificates=certificates,
            dns_result=dns_result,
            http_result=http_result,
            https_result=https_result,
        )

    async def _get(self, path: str) -> dict | list:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.get(path)
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, (dict, list)):
                    raise ValueError("Traefik API 응답 형식이 올바르지 않습니다")
                return payload
        except (httpx.HTTPError, ValueError) as exc:
            raise TraefikApiClientError(f"Traefik API 호출 실패: {path}") from exc
