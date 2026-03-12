from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

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


class StubServiceCrudUseCases:
    def __init__(self, before_service=None, after_service=None):
        self.before_service = before_service
        self.after_service = after_service
        self.updated_payload = None
        self.rollback_service_id = None

    async def get_service(self, service_id):
        if self.before_service and str(getattr(self.before_service, "id")) == str(service_id):
            return self.before_service
        if self.after_service and str(getattr(self.after_service, "id")) == str(service_id):
            return self.after_service
        return self.before_service

    async def update_service(self, service_id, data):
        self.rollback_service_id = service_id
        self.updated_payload = data.model_dump(exclude_unset=True)
        return self.after_service


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


def make_service(**overrides):
    service_id = overrides.pop("id", uuid4())
    defaults = {
        "id": service_id,
        "name": "svc",
        "domain": "svc.example.com",
        "upstream_host": "app",
        "upstream_port": 8080,
        "upstream_scheme": "http",
        "skip_tls_verify": False,
        "tls_enabled": True,
        "https_redirect_enabled": True,
        "auth_mode": "none",
        "api_key": None,
        "allowed_ips": [],
        "blocked_paths": [],
        "middleware_template_ids": [],
        "rate_limit_average": None,
        "rate_limit_burst": None,
        "custom_headers": {},
        "frame_policy": "deny",
        "healthcheck_enabled": True,
        "healthcheck_path": "/",
        "healthcheck_timeout_ms": 3000,
        "healthcheck_expected_statuses": [],
        "basic_auth_users": [],
        "authentik_group_id": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_update_service_records_diff_audit(monkeypatch):
    service_id = uuid4()
    before_service = make_service(id=service_id, name="svc", upstream_host="app", upstream_port=8080)
    after_service = make_service(id=service_id, name="svc-web", upstream_host="web", upstream_port=9090)
    use_cases = StubServiceCrudUseCases(before_service=before_service, after_service=after_service)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(services_router.audit_service, "record", fake_record, raising=False)

    response = await services_router.update_service(
        service_id=service_id,
        data=services_router.ServiceUpdate(name="svc-web", upstream_host="web", upstream_port=9090),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert response.name == "svc-web"
    assert recorded[0]["action"] == "update"
    assert recorded[0]["resource_type"] == "service"
    assert recorded[0]["detail"]["event"] == "service_update"
    assert recorded[0]["detail"]["changed_keys"] == ["name", "upstream_host", "upstream_port"]
    assert recorded[0]["detail"]["before"]["name"] == "svc"
    assert recorded[0]["detail"]["after"]["name"] == "svc-web"
    assert recorded[0]["detail"]["rollback_supported"] is True
    assert recorded[0]["detail"]["rollback_payload"]["name"] == "svc"


@pytest.mark.asyncio
async def test_update_service_marks_rollback_unsupported_for_token_or_basic_auth(monkeypatch):
    service_id = uuid4()
    before_service = make_service(id=service_id, auth_mode="token", api_key="secret-token")
    after_service = make_service(id=service_id, auth_mode="token", api_key="new-secret")
    use_cases = StubServiceCrudUseCases(before_service=before_service, after_service=after_service)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(services_router.audit_service, "record", fake_record, raising=False)

    await services_router.update_service(
        service_id=service_id,
        data=services_router.ServiceUpdate(auth_mode="token", api_key="new-secret"),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert recorded[0]["detail"]["rollback_supported"] is False
    assert "rollback_payload" not in recorded[0]["detail"]


@pytest.mark.asyncio
async def test_rollback_service_change_restores_previous_payload(monkeypatch):
    service_id = uuid4()
    before_service = make_service(id=service_id, name="svc-web", upstream_host="web", upstream_port=9090)
    after_service = make_service(id=service_id, name="svc", upstream_host="app", upstream_port=8080)
    use_cases = StubServiceCrudUseCases(before_service=before_service, after_service=after_service)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    class StubExecuteResult:
        def __init__(self, item):
            self._item = item

        def scalar_one_or_none(self):
            return self._item

    class StubDB:
        def __init__(self, item):
            self.item = item

        async def execute(self, _query):
            return StubExecuteResult(self.item)

    monkeypatch.setattr(services_router.audit_service, "record", fake_record, raising=False)

    response = await services_router.rollback_service_change(
        audit_log_id="log-service-1",
        use_cases=use_cases,
        db=StubDB(
            SimpleNamespace(
                id="log-service-1",
                actor="admin",
                action="update",
                resource_type="service",
                resource_id=str(service_id),
                resource_name="svc-web",
                detail={
                    "event": "service_update",
                    "rollback_supported": True,
                    "rollback_payload": {"name": "svc", "upstream_host": "app", "upstream_port": 8080},
                    "before": {"name": "svc", "upstream_host": "app", "upstream_port": 8080},
                    "after": {"name": "svc-web", "upstream_host": "web", "upstream_port": 9090},
                },
            )
        ),
        current_user={"username": "admin"},
    )

    assert response.name == "svc"
    assert use_cases.updated_payload == {"name": "svc", "upstream_host": "app", "upstream_port": 8080}
    assert recorded[0]["action"] == "rollback"
    assert recorded[0]["detail"]["event"] == "service_rollback"
    assert recorded[0]["detail"]["source_audit_id"] == "log-service-1"


@pytest.mark.asyncio
async def test_rollback_service_change_rejects_unsupported_log():
    class StubExecuteResult:
        def __init__(self, item):
            self._item = item

        def scalar_one_or_none(self):
            return self._item

    class StubDB:
        def __init__(self, item):
            self.item = item

        async def execute(self, _query):
            return StubExecuteResult(self.item)

    with pytest.raises(HTTPException):
        await services_router.rollback_service_change(
            audit_log_id="log-service-2",
            use_cases=StubServiceCrudUseCases(),
            db=StubDB(
                SimpleNamespace(
                    id="log-service-2",
                    actor="admin",
                    action="update",
                    resource_type="service",
                    resource_id=str(uuid4()),
                    resource_name="svc",
                    detail={"event": "service_update", "rollback_supported": False},
                )
            ),
            current_user={"username": "admin"},
        )
