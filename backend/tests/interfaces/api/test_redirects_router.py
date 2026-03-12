from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers import redirects as redirects_router


class StubRedirectUseCases:
    def __init__(self, before_redirect=None, after_redirect=None):
        self.before_redirect = before_redirect
        self.after_redirect = after_redirect
        self.updated_payload = None
        self.created_payload = None
        self.deleted_redirect_id = None

    async def get_redirect_host(self, redirect_id):
        if self.before_redirect and str(getattr(self.before_redirect, "id")) == str(redirect_id):
            return self.before_redirect
        if self.after_redirect and str(getattr(self.after_redirect, "id")) == str(redirect_id):
            return self.after_redirect
        return self.before_redirect

    async def create_redirect_host(self, data):
        self.created_payload = data.model_dump()
        return self.after_redirect

    async def update_redirect_host(self, redirect_id, data):
        self.updated_payload = data.model_dump(exclude_unset=True)
        return self.after_redirect

    async def delete_redirect_host(self, redirect_id):
        self.deleted_redirect_id = redirect_id


def make_redirect(**overrides):
    redirect_id = overrides.pop("id", uuid4())
    defaults = {
        "id": redirect_id,
        "domain": "old.example.com",
        "target_url": "https://target.example.com",
        "permanent": True,
        "tls_enabled": True,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_create_redirect_records_create_event(monkeypatch):
    redirect_id = uuid4()
    redirect = make_redirect(id=redirect_id, domain="old.example.com", target_url="https://target.example.com")
    use_cases = StubRedirectUseCases(after_redirect=redirect)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(redirects_router.audit_service, "record", fake_record, raising=False)

    response = await redirects_router.create_redirect_host(
        data=redirects_router.RedirectHostCreate(domain="old.example.com", target_url="https://target.example.com"),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert response.domain == "old.example.com"
    assert recorded[0]["action"] == "create"
    assert recorded[0]["resource_type"] == "redirect"
    assert recorded[0]["detail"]["event"] == "redirect_create"
    assert recorded[0]["detail"]["target_url"] == "https://target.example.com"


@pytest.mark.asyncio
async def test_update_redirect_records_diff_audit(monkeypatch):
    redirect_id = uuid4()
    before_redirect = make_redirect(id=redirect_id, target_url="https://old.example.com")
    after_redirect = make_redirect(
        id=redirect_id,
        target_url="https://new.example.com",
        permanent=False,
    )
    use_cases = StubRedirectUseCases(before_redirect=before_redirect, after_redirect=after_redirect)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(redirects_router.audit_service, "record", fake_record, raising=False)

    response = await redirects_router.update_redirect_host(
        redirect_id=redirect_id,
        data=redirects_router.RedirectHostUpdate(target_url="https://new.example.com", permanent=False),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert response.target_url == "https://new.example.com"
    assert recorded[0]["action"] == "update"
    assert recorded[0]["resource_type"] == "redirect"
    assert recorded[0]["detail"]["event"] == "redirect_update"
    assert recorded[0]["detail"]["changed_keys"] == ["permanent", "target_url"]
    assert recorded[0]["detail"]["before"]["target_url"] == "https://old.example.com"
    assert recorded[0]["detail"]["after"]["target_url"] == "https://new.example.com"
    assert recorded[0]["detail"]["rollback_supported"] is True
    assert recorded[0]["detail"]["rollback_payload"]["target_url"] == "https://old.example.com"


@pytest.mark.asyncio
async def test_rollback_redirect_change_restores_previous_payload(monkeypatch):
    redirect_id = uuid4()
    before_redirect = make_redirect(id=redirect_id, target_url="https://new.example.com", permanent=False)
    after_redirect = make_redirect(id=redirect_id, target_url="https://old.example.com", permanent=True)
    use_cases = StubRedirectUseCases(before_redirect=before_redirect, after_redirect=after_redirect)
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

    monkeypatch.setattr(redirects_router.audit_service, "record", fake_record, raising=False)

    response = await redirects_router.rollback_redirect_change(
        audit_log_id="log-redirect-1",
        use_cases=use_cases,
        db=StubDB(
            SimpleNamespace(
                id="log-redirect-1",
                actor="admin",
                action="update",
                resource_type="redirect",
                resource_id=str(redirect_id),
                resource_name="old.example.com",
                detail={
                    "event": "redirect_update",
                    "rollback_supported": True,
                    "rollback_payload": {
                        "target_url": "https://old.example.com",
                        "permanent": True,
                        "tls_enabled": True,
                    },
                    "before": {"target_url": "https://old.example.com", "permanent": True, "tls_enabled": True},
                    "after": {"target_url": "https://new.example.com", "permanent": False, "tls_enabled": True},
                },
            )
        ),
        current_user={"username": "admin"},
    )

    assert response.target_url == "https://old.example.com"
    assert use_cases.updated_payload == {
        "target_url": "https://old.example.com",
        "permanent": True,
        "tls_enabled": True,
    }
    assert recorded[0]["action"] == "rollback"
    assert recorded[0]["resource_type"] == "redirect"
    assert recorded[0]["detail"]["event"] == "redirect_rollback"


@pytest.mark.asyncio
async def test_rollback_redirect_change_rejects_unsupported_log():
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
        await redirects_router.rollback_redirect_change(
            audit_log_id="log-redirect-2",
            use_cases=StubRedirectUseCases(),
            db=StubDB(
                SimpleNamespace(
                    id="log-redirect-2",
                    actor="admin",
                    action="update",
                    resource_type="redirect",
                    resource_id=str(uuid4()),
                    resource_name="old.example.com",
                    detail={"event": "redirect_update", "rollback_supported": False},
                )
            ),
            current_user={"username": "admin"},
        )


@pytest.mark.asyncio
async def test_delete_redirect_records_delete_event(monkeypatch):
    redirect_id = uuid4()
    redirect = make_redirect(id=redirect_id, domain="old.example.com", target_url="https://target.example.com")
    use_cases = StubRedirectUseCases(before_redirect=redirect)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(redirects_router.audit_service, "record", fake_record, raising=False)

    await redirects_router.delete_redirect_host(
        redirect_id=redirect_id,
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert use_cases.deleted_redirect_id == redirect_id
    assert recorded[0]["action"] == "delete"
    assert recorded[0]["resource_type"] == "redirect"
    assert recorded[0]["detail"]["event"] == "redirect_delete"
    assert recorded[0]["detail"]["target_url"] == "https://target.example.com"
