import asyncio
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx

from app.core.config import settings


class TraefikApiClientError(Exception):
    """Traefik API 호출 실패 예외"""


class TraefikApiClient:
    """Traefik REST API 클라이언트"""

    def __init__(self):
        self.base_url = settings.TRAEFIK_API_URL.rstrip("/")
        self.timeout = settings.TRAEFIK_API_TIMEOUT_SECONDS

    async def get_health(self) -> dict:
        try:
            overview = await self._get("/api/overview")
        except TraefikApiClientError:
            return {
                "connected": False,
                "message": "Traefik에 연결할 수 없습니다",
                "version": None,
            }

        version = overview.get("version") if isinstance(overview, dict) else None
        return {
            "connected": True,
            "message": "Traefik 연결됨",
            "version": version,
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

        routers = self._normalize_routers(payload)
        domain_states: dict[str, dict] = {}

        for router in routers:
            router_name = router.get("name") or router.get("service") or "unknown"
            status_raw = str(router.get("status", "enabled")).lower()
            active = status_raw not in ("disabled", "error", "unknown")
            rule = str(router.get("rule", ""))
            domains = self._extract_domains_from_router(router)

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

    async def list_certificates(self) -> list[dict]:
        overview, routers_payload = await asyncio.gather(
            self._get("/api/overview"),
            self._get("/api/http/routers"),
        )

        expiry_map = self._extract_expiry_map(overview)
        routers = self._normalize_routers(routers_payload)

        certificates_by_domain: dict[str, dict] = {}
        for router in routers:
            tls_info = router.get("tls")
            if not tls_info:
                continue

            domains = self._extract_domains_from_router(router)
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
                        "expires_at": self._find_expiry(domain, expiry_map),
                    },
                )
                cert["router_names"].add(router_name)
                if resolver:
                    cert["cert_resolvers"].add(str(resolver))

        result = [self._to_certificate_response(cert) for cert in certificates_by_domain.values()]
        return sorted(result, key=lambda item: (item["days_remaining"] is None, item["days_remaining"] or 99999, item["domain"]))

    async def _get(self, path: str) -> dict | list:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.get(path)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            raise TraefikApiClientError(f"Traefik API 호출 실패: {path}") from exc

    def _normalize_routers(self, payload: dict | list) -> list[dict]:
        if isinstance(payload, list):
            return [router for router in payload if isinstance(router, dict)]

        if isinstance(payload, dict):
            if "routers" in payload and isinstance(payload["routers"], list):
                return [router for router in payload["routers"] if isinstance(router, dict)]

            if all(isinstance(value, dict) for value in payload.values()):
                normalized = []
                for name, value in payload.items():
                    router = value.copy()
                    router.setdefault("name", name)
                    normalized.append(router)
                return normalized

        return []

    def _extract_domains_from_router(self, router: dict) -> list[str]:
        domains: set[str] = set()

        rule = router.get("rule")
        if isinstance(rule, str):
            domains.update(self._extract_domains_from_rule(rule))

        tls = router.get("tls")
        if isinstance(tls, dict):
            tls_domains = tls.get("domains")
            if isinstance(tls_domains, list):
                for item in tls_domains:
                    if not isinstance(item, dict):
                        continue
                    main = item.get("main")
                    if isinstance(main, str) and main:
                        domains.add(main)
                    sans = item.get("sans")
                    if isinstance(sans, list):
                        for san in sans:
                            if isinstance(san, str) and san:
                                domains.add(san)

        return sorted(domains)

    def _extract_domains_from_rule(self, rule: str) -> list[str]:
        domains: set[str] = set()
        for match in re.findall(r"Host\(([^)]+)\)", rule):
            for token in match.split(","):
                value = token.strip().strip("`").strip('"').strip("'")
                if value:
                    domains.add(value)
        return list(domains)

    def _extract_expiry_map(self, payload: dict | list) -> dict[str, datetime]:
        expiry_map: dict[str, datetime] = {}

        def walk(node):
            if isinstance(node, dict):
                domain_candidates = self._extract_domain_candidates(node)
                expires_at = self._extract_expiry(node)
                if domain_candidates and expires_at:
                    for domain in domain_candidates:
                        existing = expiry_map.get(domain)
                        if existing is None or expires_at < existing:
                            expiry_map[domain] = expires_at
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)

        walk(payload)
        return expiry_map

    def _extract_domain_candidates(self, node: dict) -> set[str]:
        domains: set[str] = set()

        single_domain = node.get("domain")
        if isinstance(single_domain, str) and single_domain:
            domains.add(single_domain)
        elif isinstance(single_domain, dict):
            main = single_domain.get("main")
            if isinstance(main, str) and main:
                domains.add(main)
            sans = single_domain.get("sans")
            if isinstance(sans, list):
                for san in sans:
                    if isinstance(san, str) and san:
                        domains.add(san)

        domain_list = node.get("domains")
        if isinstance(domain_list, list):
            for item in domain_list:
                if isinstance(item, str) and item:
                    domains.add(item)
                elif isinstance(item, dict):
                    main = item.get("main")
                    if isinstance(main, str) and main:
                        domains.add(main)
                    sans = item.get("sans")
                    if isinstance(sans, list):
                        for san in sans:
                            if isinstance(san, str) and san:
                                domains.add(san)

        return domains

    def _extract_expiry(self, node: dict) -> datetime | None:
        for key in ("notAfter", "not_after", "expiresAt", "expires_at", "expiration", "expirationDate", "expiryDate"):
            value = node.get(key)
            parsed = self._parse_datetime(value)
            if parsed:
                return parsed
        return None

    def _parse_datetime(self, value) -> datetime | None:
        if not isinstance(value, str) or not value.strip():
            return None

        raw = value.strip()
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            pass

        try:
            dt = parsedate_to_datetime(raw)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except (TypeError, ValueError):
            return None

    def _find_expiry(self, domain: str, expiry_map: dict[str, datetime]) -> datetime | None:
        if domain in expiry_map:
            return expiry_map[domain]

        for cert_domain, expires_at in expiry_map.items():
            if cert_domain.startswith("*.") and domain.endswith(cert_domain[1:]):
                return expires_at
        return None

    def _to_certificate_response(self, cert: dict) -> dict:
        now = datetime.now(timezone.utc)
        expires_at = cert.get("expires_at")

        status = "warning"
        message = "만료일 정보를 확인할 수 없습니다"
        days_remaining = None

        if isinstance(expires_at, datetime):
            days_remaining = int((expires_at - now).total_seconds() // 86400)
            if expires_at < now:
                status = "error"
                message = "인증서가 만료되었습니다"
            elif days_remaining <= 30:
                status = "warning"
                message = f"{days_remaining}일 이내 만료 예정"
            else:
                status = "active"
                message = "정상"

        return {
            "domain": cert["domain"],
            "router_names": sorted(cert["router_names"]),
            "cert_resolvers": sorted(cert["cert_resolvers"]),
            "expires_at": expires_at,
            "days_remaining": days_remaining,
            "status": status,
            "status_message": message,
        }
