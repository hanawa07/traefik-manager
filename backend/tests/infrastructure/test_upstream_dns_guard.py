import pytest

from app.infrastructure.network.upstream_dns_guard import UpstreamDnsGuard


class StubSettingsRepository:
    def __init__(
        self,
        *,
        enabled: bool,
        allowlist_enabled: bool = False,
        allowed_domain_suffixes: str | None = None,
        allow_docker_service_names: bool = True,
        allow_private_networks: bool = True,
    ):
        self.enabled = enabled
        self.allowlist_enabled = allowlist_enabled
        self.allowed_domain_suffixes = allowed_domain_suffixes
        self.allow_docker_service_names = allow_docker_service_names
        self.allow_private_networks = allow_private_networks

    async def get(self, key: str) -> str | None:
        if key == "upstream_dns_strict_mode":
            return "true" if self.enabled else "false"
        if key == "upstream_allowlist_enabled":
            return "true" if self.allowlist_enabled else "false"
        if key == "upstream_allowed_domain_suffixes":
            return self.allowed_domain_suffixes
        if key == "upstream_allow_docker_service_names":
            return "true" if self.allow_docker_service_names else "false"
        if key == "upstream_allow_private_networks":
            return "true" if self.allow_private_networks else "false"
        return None


@pytest.mark.asyncio
async def test_guard_skips_resolution_when_strict_mode_disabled():
    called = False

    async def resolver(_host: str) -> list[str]:
        nonlocal called
        called = True
        return ["127.0.0.1"]

    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(enabled=False),
        resolver=resolver,
    )

    await guard.ensure_safe("example.com")

    assert called is False


@pytest.mark.asyncio
async def test_guard_blocks_host_when_resolved_ip_is_forbidden():
    async def resolver(_host: str) -> list[str]:
        return ["127.0.0.1"]

    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(enabled=True),
        resolver=resolver,
    )

    with pytest.raises(ValueError, match="DNS strict mode에서 금지된 주소로 해석됩니다: example.com -> 127.0.0.1"):
        await guard.ensure_safe("example.com")


@pytest.mark.asyncio
async def test_guard_blocks_unresolvable_host_when_strict_mode_enabled():
    async def resolver(_host: str) -> list[str]:
        raise RuntimeError("dns failed")

    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(enabled=True),
        resolver=resolver,
    )

    with pytest.raises(ValueError, match="DNS strict mode에서 upstream 호스트를 해석할 수 없습니다: example.com"):
        await guard.ensure_safe("example.com")


@pytest.mark.asyncio
async def test_guard_allows_private_resolution_when_ip_itself_is_allowed():
    async def resolver(_host: str) -> list[str]:
        return ["10.0.0.5"]

    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(enabled=True),
        resolver=resolver,
    )

    await guard.ensure_safe("internal.example.com")


@pytest.mark.asyncio
async def test_guard_allows_host_matching_allowlist_suffix():
    called = False

    async def resolver(_host: str) -> list[str]:
        nonlocal called
        called = True
        return ["93.184.216.34"]

    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(
            enabled=False,
            allowlist_enabled=True,
            allowed_domain_suffixes="example.com",
        ),
        resolver=resolver,
    )

    await guard.ensure_safe("api.example.com")

    assert called is False


@pytest.mark.asyncio
async def test_guard_blocks_external_host_not_in_allowlist():
    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(
            enabled=False,
            allowlist_enabled=True,
            allowed_domain_suffixes="example.com",
        ),
    )

    with pytest.raises(ValueError, match="업스트림 allowlist에 없는 외부 도메인입니다: evil.com"):
        await guard.ensure_safe("evil.com")


@pytest.mark.asyncio
async def test_guard_blocks_docker_service_name_when_option_disabled():
    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(
            enabled=False,
            allowlist_enabled=True,
            allow_docker_service_names=False,
        ),
    )

    with pytest.raises(ValueError, match="업스트림 allowlist에서 Docker 서비스명 사용이 비활성화되어 있습니다: vaultwarden"):
        await guard.ensure_safe("vaultwarden")


@pytest.mark.asyncio
async def test_guard_allows_private_network_ip_when_option_enabled():
    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(
            enabled=False,
            allowlist_enabled=True,
            allow_private_networks=True,
        ),
    )

    await guard.ensure_safe("192.168.0.10")


@pytest.mark.asyncio
async def test_guard_blocks_public_ip_when_allowlist_enabled():
    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(
            enabled=False,
            allowlist_enabled=True,
            allow_private_networks=True,
        ),
    )

    with pytest.raises(ValueError, match="업스트림 allowlist에서 허용되지 않은 IP 주소입니다: 8.8.8.8"):
        await guard.ensure_safe("8.8.8.8")


@pytest.mark.asyncio
async def test_guard_requires_allowlist_and_strict_mode_to_both_pass():
    async def resolver(_host: str) -> list[str]:
        return ["127.0.0.1"]

    guard = UpstreamDnsGuard(
        settings_repository=StubSettingsRepository(
            enabled=True,
            allowlist_enabled=True,
            allowed_domain_suffixes="example.com",
        ),
        resolver=resolver,
    )

    with pytest.raises(ValueError, match="DNS strict mode에서 금지된 주소로 해석됩니다: api.example.com -> 127.0.0.1"):
        await guard.ensure_safe("api.example.com")
