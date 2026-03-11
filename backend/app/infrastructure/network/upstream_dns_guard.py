import asyncio
import socket
from dataclasses import dataclass

from app.domain.proxy.value_objects.upstream import (
    is_ip_literal,
    is_private_network_upstream_ip,
    matches_domain_suffix,
    normalize_domain_suffixes,
    validate_upstream_ip_address,
)


@dataclass(frozen=True)
class UpstreamSecurityPolicy:
    dns_strict_mode: bool
    allowlist_enabled: bool
    allowed_domain_suffixes: list[str]
    allow_docker_service_names: bool
    allow_private_networks: bool


class UpstreamDnsGuard:
    def __init__(self, settings_repository, resolver=None):
        self.settings_repository = settings_repository
        self.resolver = resolver or self._resolve_host

    async def ensure_safe(self, host: str) -> None:
        policy = await self._load_policy()

        if policy.allowlist_enabled:
            self._ensure_allowlisted(host, policy)

        if is_ip_literal(host):
            return

        if not policy.dns_strict_mode:
            return

        try:
            resolved_ips = await self.resolver(host)
        except Exception as exc:
            raise ValueError(f"DNS strict mode에서 upstream 호스트를 해석할 수 없습니다: {host}") from exc

        if not resolved_ips:
            raise ValueError(f"DNS strict mode에서 upstream 호스트를 해석할 수 없습니다: {host}")

        for resolved_ip in resolved_ips:
            try:
                validate_upstream_ip_address(resolved_ip)
            except ValueError as exc:
                raise ValueError(
                    f"DNS strict mode에서 금지된 주소로 해석됩니다: {host} -> {resolved_ip}"
                ) from exc

    def _ensure_allowlisted(self, host: str, policy: UpstreamSecurityPolicy) -> None:
        if is_ip_literal(host):
            if policy.allow_private_networks and is_private_network_upstream_ip(host):
                return
            raise ValueError(f"업스트림 allowlist에서 허용되지 않은 IP 주소입니다: {host}")

        if "." not in host:
            if policy.allow_docker_service_names:
                return
            raise ValueError(f"업스트림 allowlist에서 Docker 서비스명 사용이 비활성화되어 있습니다: {host}")

        if matches_domain_suffix(host, policy.allowed_domain_suffixes):
            return

        raise ValueError(f"업스트림 allowlist에 없는 외부 도메인입니다: {host}")

    async def _load_policy(self) -> UpstreamSecurityPolicy:
        dns_strict_mode = await self._get_bool("upstream_dns_strict_mode", default=False)
        allowlist_enabled = await self._get_bool("upstream_allowlist_enabled", default=False)
        allowed_domain_suffixes = normalize_domain_suffixes(
            self._split_suffixes(await self.settings_repository.get("upstream_allowed_domain_suffixes"))
        )
        allow_docker_service_names = await self._get_bool("upstream_allow_docker_service_names", default=True)
        allow_private_networks = await self._get_bool("upstream_allow_private_networks", default=True)
        return UpstreamSecurityPolicy(
            dns_strict_mode=dns_strict_mode,
            allowlist_enabled=allowlist_enabled,
            allowed_domain_suffixes=allowed_domain_suffixes,
            allow_docker_service_names=allow_docker_service_names,
            allow_private_networks=allow_private_networks,
        )

    async def _get_bool(self, key: str, *, default: bool) -> bool:
        value = await self.settings_repository.get(key)
        if value is None:
            return default
        return value.strip().lower() == "true"

    def _split_suffixes(self, value: str | None) -> list[str]:
        if not value:
            return []
        return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]

    async def _resolve_host(self, host: str) -> list[str]:
        loop = asyncio.get_running_loop()
        results = await loop.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        addresses: list[str] = []
        seen: set[str] = set()

        for _, _, _, _, sockaddr in results:
            address = sockaddr[0]
            if address in seen:
                continue
            seen.add(address)
            addresses.append(address)

        return addresses
