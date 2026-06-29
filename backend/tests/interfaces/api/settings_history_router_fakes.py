from collections.abc import Mapping
from datetime import datetime
from types import SimpleNamespace


class StubAuditQueryResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None


class StubAuditHistoryDb:
    def __init__(self, logs):
        self._logs = logs

    async def execute(self, _query):
        return StubAuditQueryResult(self._logs)


class StubSingleAuditLogDb(StubAuditHistoryDb):
    def __init__(self, log):
        super().__init__([log] if log else [])


def make_request(client_host: str = "127.0.0.1"):
    return SimpleNamespace(headers={}, client=SimpleNamespace(host=client_host))


def make_settings_history_log(
    *,
    log_id: str,
    event: str,
    created_at: datetime,
    action: str | None = None,
    actor: str = "admin",
    resource_id: str | None = None,
    resource_name: str = "설정 테스트",
    detail: Mapping[str, object] | None = None,
):
    payload: dict[str, object] = {"event": event}
    if detail:
        payload.update(detail)
    return SimpleNamespace(
        id=log_id,
        actor=actor,
        action=action or ("alert" if "delivery" in event else "test"),
        resource_type="settings",
        resource_id=resource_id or event,
        resource_name=resource_name,
        detail=payload,
        created_at=created_at,
    )
