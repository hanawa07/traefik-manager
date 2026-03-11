import asyncio
import socket

from app.domain.proxy.value_objects.upstream import is_ip_literal, validate_upstream_ip_address


class UpstreamDnsGuard:
    def __init__(self, settings_repository, resolver=None):
        self.settings_repository = settings_repository
        self.resolver = resolver or self._resolve_host

    async def ensure_safe(self, host: str) -> None:
        if is_ip_literal(host):
            return

        if not await self._is_strict_mode_enabled():
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

    async def _is_strict_mode_enabled(self) -> bool:
        value = await self.settings_repository.get("upstream_dns_strict_mode")
        return (value or "").strip().lower() == "true"

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
