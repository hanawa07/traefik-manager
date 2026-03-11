from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.interfaces.api.v1.routers import services as services_router


class StubUseCases:
    async def list_services(self):
        return [
            SimpleNamespace(
                id=SimpleNamespace(value=uuid4()),
                domain="svc.example.com",
                upstream_host="example.com",
                upstream_port=443,
                upstream_scheme="https",
                skip_tls_verify=True,
                healthcheck_enabled=False,
                healthcheck_path="/readyz",
                healthcheck_timeout_ms=1200,
                healthcheck_expected_statuses=[200, 204],
            )
        ]


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
