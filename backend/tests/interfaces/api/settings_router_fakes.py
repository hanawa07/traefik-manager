from datetime import datetime
from types import SimpleNamespace


class StubSettingsRepository:
    def __init__(self, _session):
        self.store = StubSettingsRepository.store

    store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def get_all_dict(self) -> dict[str, str]:
        return dict(self.store)

    async def set(self, key: str, value: str | None) -> None:
        if value is None:
            self.store.pop(key, None)
        else:
            self.store[key] = value

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)


class RecordingDashboardFileWriter:
    def __init__(self):
        self.write_calls = []
        self.deleted = False

    def write_traefik_dashboard_public_route(self, domain, basic_auth_username, basic_auth_password_hash):
        self.write_calls.append((domain, basic_auth_username, basic_auth_password_hash))

    def delete_traefik_dashboard_public_route(self):
        self.deleted = True


class StubDomainRepository:
    domain_result = None

    def __init__(self, _session):
        pass

    async def find_by_domain(self, _domain: str):
        return self.domain_result


class StubNoConflictRepository:
    def __init__(self, _session):
        pass

    async def find_by_domain(self, _domain: str):
        return None


class StubScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class StubExecuteResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return StubScalarResult(self._items)


class StubAuditHistoryDb:
    def __init__(self, logs):
        self._logs = logs

    async def execute(self, _query):
        return StubExecuteResult(self._logs)


def make_audit_log(
    *,
    event: str,
    created_at: datetime,
    success: bool | None = None,
    message: str | None = None,
    detail: str | None = None,
    provider: str | None = None,
):
    payload: dict[str, object] = {"event": event}
    if success is not None:
        payload["success"] = success
    if message is not None:
        payload["message"] = message
    if detail is not None:
        payload["detail"] = detail
    if provider is not None:
        payload["provider"] = provider
    return SimpleNamespace(
        id="audit-log-id",
        actor="system",
        action="alert" if "delivery" in event else "test",
        resource_type="settings",
        resource_id="settings-audit",
        resource_name="설정 테스트",
        detail=payload,
        created_at=created_at,
    )
