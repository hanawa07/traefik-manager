from uuid import uuid4

import pytest

from app.interfaces.api.v1.routers import services as services_router
from tests.interfaces.api.services_router_fakes import StubServiceCrudUseCases, make_service


@pytest.mark.asyncio
async def test_create_service_records_create_event(monkeypatch):
    service_id = uuid4()
    created_service = make_service(id=service_id, name="svc", domain="svc.example.com")
    use_cases = StubServiceCrudUseCases(after_service=created_service)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(services_router.audit_service, "record", fake_record, raising=False)

    response = await services_router.create_service(
        data=services_router.ServiceCreate(
            name="svc",
            domain="svc.example.com",
            upstream_host="app",
            upstream_port=8080,
        ),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert response.name == "svc"
    assert recorded[0]["action"] == "create"
    assert recorded[0]["resource_type"] == "service"
    assert recorded[0]["detail"]["event"] == "service_create"
    assert recorded[0]["detail"]["domain"] == "svc.example.com"


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
async def test_update_service_records_bulk_operation_id(monkeypatch):
    service_id = uuid4()
    operation_id = uuid4()
    before_service = make_service(id=service_id, routing_mode="active")
    after_service = make_service(id=service_id, routing_mode="maintenance")
    use_cases = StubServiceCrudUseCases(before_service=before_service, after_service=after_service)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(services_router.audit_service, "record", fake_record, raising=False)

    await services_router.update_service(
        service_id=service_id,
        data=services_router.ServiceUpdate(routing_mode="maintenance"),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
        x_bulk_operation_id=operation_id,
    )

    assert recorded[0]["detail"]["bulk_operation_id"] == str(operation_id)
    assert recorded[0]["notify"] is False


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
async def test_delete_service_records_delete_event(monkeypatch):
    service_id = uuid4()
    service = make_service(id=service_id, name="svc", domain="svc.example.com")
    use_cases = StubServiceCrudUseCases(before_service=service)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(services_router.audit_service, "record", fake_record, raising=False)

    await services_router.delete_service(
        service_id=service_id,
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert use_cases.deleted_service_id == service_id
    assert recorded[0]["action"] == "delete"
    assert recorded[0]["resource_type"] == "service"
    assert recorded[0]["detail"]["event"] == "service_delete"
    assert recorded[0]["detail"]["domain"] == "svc.example.com"
