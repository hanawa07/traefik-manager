import asyncio
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.infrastructure.traefik.acme_parsers import (
    extract_acme_certificate_expiry,
    extract_expiry_map,
    find_expiry,
    parse_acme_expiry_map,
    parse_recent_acme_failures,
    to_certificate_response,
)
from app.infrastructure.traefik.certificate_preflight import (
    build_certificate_preflight_items,
    build_preflight_recommendation,
    compute_preflight_overall_status,
    inspect_presented_certificate,
    probe_http_challenge_path,
    resolve_public_dns_records,
)
from app.infrastructure.traefik.docker_api import (
    read_docker_acme_json_text,
    read_docker_container_logs_text,
    read_local_acme_json_text,
)
from app.infrastructure.traefik.runtime_parsers import (
    compare_versions,
    extract_current_version,
    extract_domains_from_router,
    normalize_middlewares,
    normalize_routers,
    parse_version,
)


class TraefikApiClientError(Exception):
    """Traefik API 호출 실패 예외"""


class TraefikApiClient:
    """Traefik REST API 클라이언트"""

    _latest_version_cache: dict | None = None
    _latest_version_lock = asyncio.Lock()

    def __init__(self):
        self.base_url = settings.TRAEFIK_API_URL.rstrip("/")
        self.timeout = settings.TRAEFIK_API_TIMEOUT_SECONDS

    async def get_health(self) -> dict:
        overview, version_payload, latest_info = await asyncio.gather(
            self._get_overview_or_none(),
            self._get_version_or_none(),
            self._get_latest_version_info(),
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

    async def _get_latest_version_info(self) -> dict:
        now = datetime.now(timezone.utc)
        cache = self._latest_version_cache
        if cache and self._is_latest_version_cache_fresh(cache, now):
            return cache.copy()

        async with self._latest_version_lock:
            cache = self._latest_version_cache
            if cache and self._is_latest_version_cache_fresh(cache, now):
                return cache.copy()

            info = await self._fetch_latest_version_info(now)
            TraefikApiClient._latest_version_cache = info.copy()
            return info

    def _is_latest_version_cache_fresh(self, cache: dict, now: datetime) -> bool:
        checked_at = cache.get("latest_version_checked_at")
        if not isinstance(checked_at, datetime):
            return False

        max_age_seconds = max(settings.TRAEFIK_LATEST_VERSION_CACHE_SECONDS, 60)
        return (now - checked_at).total_seconds() < max_age_seconds

    async def _fetch_latest_version_info(self, checked_at: datetime) -> dict:
        try:
            async with httpx.AsyncClient(
                timeout=settings.TRAEFIK_LATEST_VERSION_TIMEOUT_SECONDS,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "traefik-manager",
                },
            ) as client:
                response = await client.get(settings.TRAEFIK_LATEST_VERSION_API_URL)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            return {
                "latest_version": None,
                "update_available": None,
                "latest_version_checked_at": checked_at,
                "latest_version_error": "최신 Traefik 버전을 확인하지 못했습니다",
            }

        latest_version = payload.get("tag_name") if isinstance(payload, dict) else None
        if not isinstance(latest_version, str) or not parse_version(latest_version):
            return {
                "latest_version": None,
                "update_available": None,
                "latest_version_checked_at": checked_at,
                "latest_version_error": "최신 Traefik 버전 응답을 해석하지 못했습니다",
            }

        return {
            "latest_version": latest_version,
            "update_available": None,
            "latest_version_checked_at": checked_at,
            "latest_version_error": None,
        }

    async def get_router_status(self) -> dict:
        try:
            payload = await self._get("/api/http/routers")
        except TraefikApiClientError:
            return {
                "connected": False,
                "message": "Traefik 라우터 정보를 가져오지 못했습니다",
                "domains": {},
            }

        routers = normalize_routers(payload)
        domain_states: dict[str, dict] = {}

        for router in routers:
            router_name = router.get("name") or router.get("service") or "unknown"
            status_raw = str(router.get("status", "enabled")).lower()
            active = status_raw not in ("disabled", "error", "unknown")
            rule = str(router.get("rule", ""))
            domains = extract_domains_from_router(router)

            for domain in domains:
                current = domain_states.setdefault(
                    domain,
                    {
                        "active": False,
                        "routers": [],
                    },
                )
                current["active"] = current["active"] or active
                current["routers"].append(
                    {
                        "name": router_name,
                        "status": status_raw,
                        "rule": rule,
                    }
                )

        return {
            "connected": True,
            "message": "Traefik 라우터 상태를 조회했습니다",
            "domains": domain_states,
        }

    async def list_middlewares(self) -> dict:
        try:
            payload = await self._get("/api/http/middlewares")
        except TraefikApiClientError:
            return {
                "connected": False,
                "message": "Traefik 미들웨어 정보를 가져오지 못했습니다",
                "middlewares": [],
            }

        middlewares = []
        for item in normalize_middlewares(payload):
            middlewares.append(
                {
                    "name": str(item.get("name") or ""),
                    "provider": item.get("provider"),
                    "status": str(item.get("status") or "unknown"),
                    "type": str(item.get("type") or "unknown"),
                    "used_by": [
                        str(value)
                        for value in item.get("usedBy", [])
                        if isinstance(value, str)
                    ],
                    "config": {
                        key: value
                        for key, value in item.items()
                        if key not in {"name", "provider", "status", "type", "usedBy"}
                    },
                }
            )

        middlewares.sort(key=lambda item: item["name"])
        return {
            "connected": True,
            "message": "Traefik 미들웨어 상태를 조회했습니다",
            "middlewares": middlewares,
        }

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

        expiry_map = extract_expiry_map(overview)
        recent_acme_failures = await self._load_recent_acme_failures()
        # acme.json 직접 파싱으로 누락된 도메인 보완 (file 라우터 등)
        acme_map = await self._load_acme_expiry_map()
        for domain, expires_at in acme_map.items():
            if domain not in expiry_map:
                expiry_map[domain] = expires_at
        routers = normalize_routers(routers_payload)

        certificates_by_domain: dict[str, dict] = {}
        for router in routers:
            tls_info = router.get("tls")
            if not tls_info:
                continue

            domains = extract_domains_from_router(router)
            if not domains:
                continue

            resolver = None
            if isinstance(tls_info, dict):
                resolver = tls_info.get("certResolver")

            router_name = router.get("name") or router.get("service") or "unknown"
            for domain in domains:
                cert = certificates_by_domain.setdefault(
                    domain,
                    {
                        "domain": domain,
                        "router_names": set(),
                        "cert_resolvers": set(),
                        "expires_at": find_expiry(domain, expiry_map),
                        "last_acme_error_at": None,
                        "last_acme_error_message": None,
                        "last_acme_error_kind": None,
                    },
                )
                cert["router_names"].add(router_name)
                if resolver:
                    cert["cert_resolvers"].add(str(resolver))
                recent_failure = recent_acme_failures.get(domain)
                if recent_failure:
                    cert["last_acme_error_at"] = recent_failure.get("occurred_at")
                    cert["last_acme_error_message"] = recent_failure.get("message")
                    cert["last_acme_error_kind"] = recent_failure.get("kind")

        result = [to_certificate_response(cert) for cert in certificates_by_domain.values()]
        return sorted(
            result,
            key=lambda item: (
                item["days_remaining"] is None,
                item["days_remaining"] or 99999,
                item["domain"],
            ),
        )

    async def get_certificate_preflight(self, domain: str, certificates: list[dict] | None = None) -> dict:
        certificates = certificates or await self.list_certificates()
        certificate = next((item for item in certificates if item["domain"] == domain), None)

        dns_result, http_result, https_result = await asyncio.gather(
            resolve_public_dns_records(domain),
            probe_http_challenge_path(domain),
            inspect_presented_certificate(domain),
        )

        items = build_certificate_preflight_items(domain, certificate, dns_result, http_result, https_result)
        overall_status = compute_preflight_overall_status(items)
        recommendation = build_preflight_recommendation(items, certificate)

        return {
            "domain": domain,
            "checked_at": datetime.now(timezone.utc),
            "overall_status": overall_status,
            "recommendation": recommendation,
            "items": items,
        }

    async def _get(self, path: str) -> dict | list:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.get(path)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            raise TraefikApiClientError(f"Traefik API 호출 실패: {path}") from exc
