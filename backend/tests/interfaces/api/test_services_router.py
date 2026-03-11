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
            )
        ]


@pytest.mark.asyncio
async def test_list_services_health_passes_scheme_and_tls_flags(monkeypatch):
    captured: list[tuple[str, int, str, bool]] = []

    async def fake_check_upstream(host: str, port: int, scheme: str, skip_tls_verify: bool):
        captured.append((host, port, scheme, skip_tls_verify))
        return {"status": "up", "status_code": 200, "latency_ms": 12, "error": None}

    monkeypatch.setattr(services_router.upstream_checker, "check_upstream", fake_check_upstream)

    response = await services_router.list_services_health(
        use_cases=StubUseCases(),
        _={"username": "admin"},
    )

    assert len(response) == 1
    assert captured == [("example.com", 443, "https", True)]
