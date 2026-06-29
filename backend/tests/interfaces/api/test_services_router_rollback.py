from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers import services as services_router
from tests.interfaces.api.services_router_fakes import (
    StubDB,
    StubServiceCrudUseCases,
    make_service,
)


@pytest.mark.asyncio
async def test_rollback_service_change_restores_previous_payload(monkeypatch):
    service_id = uuid4()
    before_service = make_service(id=service_id, name="svc-web", upstream_host="web", upstream_port=9090)
    after_service = make_service(id=service_id, name="svc", upstream_host="app", upstream_port=8080)
    use_cases = StubServiceCrudUseCases(before_service=before_service, after_service=after_service)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

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


@pytest.mark.asyncio
async def test_rollback_service_change_rejects_unsupported_log():
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
