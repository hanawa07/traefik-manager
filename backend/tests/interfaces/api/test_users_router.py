from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers import users as users_router


class StubUserUseCases:
    def __init__(self, before_user=None, after_user=None):
        self.before_user = before_user
        self.after_user = after_user
        self.updated_payload = None
        self.repository = SimpleNamespace(find_by_id=self.get_user)

    async def get_user(self, user_id):
        if self.before_user and str(getattr(self.before_user, "id")) == str(user_id):
            return self.before_user
        if self.after_user and str(getattr(self.after_user, "id")) == str(user_id):
            return self.after_user
        return self.before_user

    async def update_user(self, user_id, data):
        self.updated_payload = data.model_dump(exclude_unset=True)
        return self.after_user


def make_user(**overrides):
    user_id = overrides.pop("id", uuid4())
    defaults = {
        "id": user_id,
        "username": "viewer",
        "role": "viewer",
        "is_active": True,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_update_user_records_diff_audit(monkeypatch):
    user_id = uuid4()
    before_user = make_user(id=user_id, username="viewer", role="viewer", is_active=True)
    after_user = make_user(id=user_id, username="ops", role="admin", is_active=False)
    use_cases = StubUserUseCases(before_user=before_user, after_user=after_user)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(users_router.audit_service, "record", fake_record, raising=False)

    response = await users_router.update_user(
        user_id=user_id,
        data=users_router.UserUpdate(username="ops", role="admin", is_active=False),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert response.username == "ops"
    assert recorded[0]["resource_type"] == "user"
    assert recorded[0]["detail"]["event"] == "user_update"
    assert recorded[0]["detail"]["changed_keys"] == ["is_active", "role", "username"]
    assert recorded[0]["detail"]["before"]["username"] == "viewer"
    assert recorded[0]["detail"]["after"]["username"] == "ops"
    assert recorded[0]["detail"]["rollback_supported"] is True
    assert recorded[0]["detail"]["rollback_payload"]["username"] == "viewer"


@pytest.mark.asyncio
async def test_update_user_marks_rollback_unsupported_when_password_changes(monkeypatch):
    user_id = uuid4()
    before_user = make_user(id=user_id)
    after_user = make_user(id=user_id)
    use_cases = StubUserUseCases(before_user=before_user, after_user=after_user)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(users_router.audit_service, "record", fake_record, raising=False)

    await users_router.update_user(
        user_id=user_id,
        data=users_router.UserUpdate(password="new-secret"),
        use_cases=use_cases,
        db=object(),
        current_user={"username": "admin"},
    )

    assert recorded[0]["detail"]["rollback_supported"] is False
    assert "rollback_payload" not in recorded[0]["detail"]


@pytest.mark.asyncio
async def test_rollback_user_change_restores_previous_payload(monkeypatch):
    user_id = uuid4()
    before_user = make_user(id=user_id, username="ops", role="admin", is_active=False)
    after_user = make_user(id=user_id, username="viewer", role="viewer", is_active=True)
    use_cases = StubUserUseCases(before_user=before_user, after_user=after_user)
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

    monkeypatch.setattr(users_router.audit_service, "record", fake_record, raising=False)

    response = await users_router.rollback_user_change(
        audit_log_id="log-user-1",
        use_cases=use_cases,
        db=StubDB(
            SimpleNamespace(
                id="log-user-1",
                actor="admin",
                action="update",
                resource_type="user",
                resource_id=str(user_id),
                resource_name="ops",
                detail={
                    "event": "user_update",
                    "rollback_supported": True,
                    "rollback_payload": {
                        "username": "viewer",
                        "role": "viewer",
                        "is_active": True,
                    },
                },
            )
        ),
        current_user={"username": "admin"},
    )

    assert response.username == "viewer"
    assert use_cases.updated_payload == {
        "username": "viewer",
        "role": "viewer",
        "is_active": True,
    }
    assert recorded[0]["action"] == "rollback"
    assert recorded[0]["detail"]["event"] == "user_rollback"


@pytest.mark.asyncio
async def test_rollback_user_change_rejects_unsupported_log():
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
        await users_router.rollback_user_change(
            audit_log_id="log-user-2",
            use_cases=StubUserUseCases(),
            db=StubDB(
                SimpleNamespace(
                    id="log-user-2",
                    actor="admin",
                    action="update",
                    resource_type="user",
                    resource_id=str(uuid4()),
                    resource_name="viewer",
                    detail={"event": "user_update", "rollback_supported": False},
                )
            ),
            current_user={"username": "admin"},
        )
