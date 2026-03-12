from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers import middlewares as middlewares_router


class StubMiddlewareUseCases:
    def __init__(self, before_template=None, after_template=None):
        self.before_template = before_template
        self.after_template = after_template
        self.updated_payload = None
        self.created_payload = None
        self.deleted_template_id = None

    async def get_template(self, template_id):
        if self.before_template and str(getattr(self.before_template, "id")) == str(template_id):
            return self.before_template
        if self.after_template and str(getattr(self.after_template, "id")) == str(template_id):
            return self.after_template
        return self.before_template

    async def create_template(self, data):
        self.created_payload = data.model_dump()
        return self.after_template

    async def update_template(self, template_id, data):
        self.updated_payload = data.model_dump(exclude_unset=True)
        return self.after_template

    async def delete_template(self, template_id):
        self.deleted_template_id = template_id


def make_template(**overrides):
    template_id = overrides.pop("id", uuid4())
    defaults = {
        "id": template_id,
        "name": "allow-office",
        "type": "ipAllowList",
        "config": {"sourceRange": ["192.168.0.0/24"]},
        "shared_name": "shared-1234abcd",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_create_template_records_create_event(monkeypatch):
    template_id = uuid4()
    template = make_template(id=template_id)
    use_cases = StubMiddlewareUseCases(after_template=template)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(middlewares_router.audit_service, "record", fake_record, raising=False)

    response = await middlewares_router.create_template(
        data=middlewares_router.MiddlewareTemplateCreate(
            name="allow-office",
            type="ipAllowList",
            config={"sourceRange": ["192.168.0.0/24"]},
        ),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert response.name == "allow-office"
    assert recorded[0]["action"] == "create"
    assert recorded[0]["resource_type"] == "middleware"
    assert recorded[0]["detail"]["event"] == "middleware_create"
    assert recorded[0]["detail"]["type"] == "ipAllowList"


@pytest.mark.asyncio
async def test_update_template_records_diff_audit(monkeypatch):
    template_id = uuid4()
    before_template = make_template(id=template_id)
    after_template = make_template(
        id=template_id,
        name="allow-hq",
        config={"sourceRange": ["10.0.0.0/8"]},
    )
    use_cases = StubMiddlewareUseCases(before_template=before_template, after_template=after_template)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(middlewares_router.audit_service, "record", fake_record, raising=False)

    response = await middlewares_router.update_template(
        template_id=template_id,
        data=middlewares_router.MiddlewareTemplateUpdate(
            name="allow-hq",
            config={"sourceRange": ["10.0.0.0/8"]},
        ),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert response.name == "allow-hq"
    assert recorded[0]["resource_type"] == "middleware"
    assert recorded[0]["detail"]["event"] == "middleware_update"
    assert recorded[0]["detail"]["changed_keys"] == ["config", "name"]
    assert recorded[0]["detail"]["before"]["name"] == "allow-office"
    assert recorded[0]["detail"]["after"]["name"] == "allow-hq"
    assert recorded[0]["detail"]["rollback_supported"] is True
    assert recorded[0]["detail"]["rollback_payload"]["name"] == "allow-office"


@pytest.mark.asyncio
async def test_rollback_template_change_restores_previous_payload(monkeypatch):
    template_id = uuid4()
    before_template = make_template(
        id=template_id,
        name="allow-hq",
        config={"sourceRange": ["10.0.0.0/8"]},
    )
    after_template = make_template(id=template_id)
    use_cases = StubMiddlewareUseCases(before_template=before_template, after_template=after_template)
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

    monkeypatch.setattr(middlewares_router.audit_service, "record", fake_record, raising=False)

    response = await middlewares_router.rollback_template_change(
        audit_log_id="log-middleware-1",
        use_cases=use_cases,
        db=StubDB(
            SimpleNamespace(
                id="log-middleware-1",
                actor="admin",
                action="update",
                resource_type="middleware",
                resource_id=str(template_id),
                resource_name="allow-hq",
                detail={
                    "event": "middleware_update",
                    "rollback_supported": True,
                    "rollback_payload": {
                        "name": "allow-office",
                        "type": "ipAllowList",
                        "config": {"sourceRange": ["192.168.0.0/24"]},
                    },
                },
            )
        ),
        current_user={"username": "admin"},
    )

    assert response.name == "allow-office"
    assert use_cases.updated_payload == {
        "name": "allow-office",
        "type": "ipAllowList",
        "config": {"sourceRange": ["192.168.0.0/24"]},
    }
    assert recorded[0]["action"] == "rollback"
    assert recorded[0]["detail"]["event"] == "middleware_rollback"


@pytest.mark.asyncio
async def test_rollback_template_change_rejects_unsupported_log():
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
        await middlewares_router.rollback_template_change(
            audit_log_id="log-middleware-2",
            use_cases=StubMiddlewareUseCases(),
            db=StubDB(
                SimpleNamespace(
                    id="log-middleware-2",
                    actor="admin",
                    action="update",
                    resource_type="middleware",
                    resource_id=str(uuid4()),
                    resource_name="allow-hq",
                    detail={"event": "middleware_update", "rollback_supported": False},
                )
            ),
            current_user={"username": "admin"},
        )


@pytest.mark.asyncio
async def test_delete_template_records_delete_event(monkeypatch):
    template_id = uuid4()
    template = make_template(id=template_id)
    use_cases = StubMiddlewareUseCases(before_template=template)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(middlewares_router.audit_service, "record", fake_record, raising=False)

    await middlewares_router.delete_template(
        template_id=template_id,
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert use_cases.deleted_template_id == template_id
    assert recorded[0]["action"] == "delete"
    assert recorded[0]["resource_type"] == "middleware"
    assert recorded[0]["detail"]["event"] == "middleware_delete"
    assert recorded[0]["detail"]["type"] == "ipAllowList"
