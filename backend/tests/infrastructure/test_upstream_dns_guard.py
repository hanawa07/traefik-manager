import pytest

from app.infrastructure.network.upstream_dns_guard import UpstreamDnsGuard


class StubSettingsRepository:
    def __init__(self, enabled: bool):
        self.enabled = enabled

    async def get(self, key: str) -> str | None:
        if key == "upstream_dns_strict_mode":
            return "true" if self.enabled else "false"
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

