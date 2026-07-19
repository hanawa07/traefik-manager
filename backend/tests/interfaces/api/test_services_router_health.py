import pytest

from app.interfaces.api.v1.routers import services as services_router
from tests.interfaces.api.services_router_fakes import StubUseCases


@pytest.mark.asyncio
async def test_list_services_health_passes_scheme_and_tls_flags(monkeypatch):
    captured: list[tuple[str, int, str, bool, bool, str, int, list[int]]] = []

    async def fake_check_upstream(
        host: str,
        port: int,
        scheme: str,
        skip_tls_verify: bool,
        healthcheck_enabled: bool,
        healthcheck_path: str,
        healthcheck_timeout_ms: int,
        healthcheck_expected_statuses: list[int],
    ):
        captured.append(
            (
                host,
                port,
                scheme,
                skip_tls_verify,
                healthcheck_enabled,
                healthcheck_path,
                healthcheck_timeout_ms,
                healthcheck_expected_statuses,
            )
        )
        return {
            "status": "up",
            "status_code": 200,
            "latency_ms": 12,
            "error": None,
            "error_kind": None,
            "checked_url": "https://example.com:443/readyz",
            "checked_at": "2026-03-11T14:40:00+00:00",
        }

    monkeypatch.setattr(services_router.upstream_checker, "check_upstream", fake_check_upstream)

    response = await services_router.list_services_health(
        use_cases=StubUseCases(),
        _={"username": "admin"},
    )

    assert len(response) == 1
    assert captured == [
        ("example.com", 443, "https", True, False, "/readyz", 1200, [200, 204])
    ]
    only_item = next(iter(response.values()))
    assert only_item.checked_url == "https://example.com:443/readyz"
    assert only_item.checked_at.isoformat() == "2026-03-11T14:40:00+00:00"


@pytest.mark.asyncio
async def test_list_services_health_skips_upstream_for_disabled_service(monkeypatch):
    async def unexpected_check(*_args):
        raise AssertionError("disabled service must not probe upstream")

    monkeypatch.setattr(services_router.upstream_checker, "check_upstream", unexpected_check)

    response = await services_router.list_services_health(
        use_cases=StubUseCases(routing_mode="disabled"),
        _={"username": "admin"},
    )

    only_item = next(iter(response.values()))
    assert only_item.status == "unknown"
    assert only_item.error == "라우팅 비활성"
    assert only_item.error_kind == "routing_disabled"
